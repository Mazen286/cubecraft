'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  enableArkhamCardTooltips?: boolean;
}

export default function RichTextEditor({ value, onChange, placeholder, enableArkhamCardTooltips = false }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true); // Default to visual editor

  // Undo/Redo history
  const [history, setHistory] = useState<string[]>([value]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoRef = useRef(false);

  // Arkham card tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; width: number; height: number; imageUrl: string; cardCode: string } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const extractCardCode = useCallback((href: string): string | null => {
    const match = href.match(/arkhamdb\.com\/card\/(\d+)/);
    return match ? match[1] : null;
  }, []);

  const getCardImageUrl = useCallback((code: string, useJpg = false): string => {
    return `https://arkhamdb.com/bundles/cards/${code}.${useJpg ? 'jpg' : 'png'}`;
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimeout(showTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setTooltip(null);
      setImageLoaded(false);
      setImageError(false);
      setFallbackAttempted(false);
    }, 200);
  }, []);

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
  }, []);

  const showTooltipForLink = useCallback((linkElement: HTMLAnchorElement) => {
    const href = linkElement.getAttribute('href') || '';
    const cardCode = extractCardCode(href);
    if (!cardCode) return;

    clearTimeout(hideTimeoutRef.current);
    clearTimeout(showTimeoutRef.current);

    showTimeoutRef.current = setTimeout(() => {
      const rect = linkElement.getBoundingClientRect();
      setImageLoaded(false);
      setImageError(false);
      setFallbackAttempted(false);
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        imageUrl: getCardImageUrl(cardCode),
        cardCode,
      });
    }, 150);
  }, [extractCardCode, getCardImageUrl]);

  // Event delegation for arkham card tooltips
  useEffect(() => {
    if (!enableArkhamCardTooltips || !showPreview || !previewRef.current) return;

    const container = previewRef.current;

    const handleMouseOver = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href*="arkhamdb.com/card/"]') as HTMLAnchorElement | null;
      if (link) {
        showTooltipForLink(link);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href*="arkhamdb.com/card/"]');
      if (link) {
        scheduleHide();
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(showTimeoutRef.current);
    };
  }, [enableArkhamCardTooltips, showPreview, showTooltipForLink, scheduleHide]);

  // Open links in new tab when clicked in visual editor
  useEffect(() => {
    if (!showPreview || !previewRef.current) return;

    const container = previewRef.current;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (link && link.href) {
        e.preventDefault();
        window.open(link.href, '_blank', 'noopener,noreferrer');
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [showPreview]);

  // Smart tooltip positioning
  const tooltipPosition = useMemo(() => {
    if (!tooltip) return null;

    const tooltipWidth = 250;
    const padding = 8;
    const gap = 8;

    // Horizontal: center on link, clamp to viewport
    let left = tooltip.x - tooltipWidth / 2;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

    // Vertical: prefer above, fall back to below
    const estimatedHeight = 350;
    let top: number;
    let placement: 'above' | 'below';

    if (tooltip.y - gap - estimatedHeight > padding) {
      top = tooltip.y - gap - estimatedHeight;
      placement = 'above';
    } else {
      top = tooltip.y + tooltip.height + gap;
      placement = 'below';
    }

    return { left, top, placement };
  }, [tooltip]);

  const handleImageError = useCallback(() => {
    if (!fallbackAttempted && tooltip) {
      setFallbackAttempted(true);
      setTooltip(prev => prev ? { ...prev, imageUrl: getCardImageUrl(prev.cardCode, true) } : null);
    } else {
      setImageError(true);
    }
  }, [fallbackAttempted, tooltip, getCardImageUrl]);

  // Track changes for undo history
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    // Only add to history if value changed and isn't from undo/redo
    if (history[historyIndex] !== value) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(value);
      // Keep only last 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [value]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  // Handle keyboard shortcuts - only for code mode (textarea)
  // In visual mode (contentEditable), let the browser handle undo/redo natively
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only intercept in code mode - visual mode uses browser's native undo
      if (showPreview) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, showPreview]);

  // Track whether we're currently editing to avoid external updates
  const isEditingRef = useRef(false);
  const lastExternalValueRef = useRef(value);

  // Sync preview edits back to value ONLY on blur
  const handlePreviewBlur = useCallback(() => {
    isEditingRef.current = false;
    if (previewRef.current) {
      const newContent = previewRef.current.innerHTML;
      if (newContent !== value) {
        lastExternalValueRef.current = newContent;
        onChange(newContent);
      }
    }
  }, [onChange, value]);

  const handlePreviewFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  // Map ArkhamDB icon names to local working icon HTML
  const getLocalIconHtml = useCallback((iconName: string): string | null => {
    const map: Record<string, string> = {
      // Skill icons — local PNGs
      willpower: '<img src="/icons/arkham/willpower.png" alt="Willpower" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      will: '<img src="/icons/arkham/willpower.png" alt="Willpower" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      intellect: '<img src="/icons/arkham/intellect.png" alt="Intellect" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      lore: '<img src="/icons/arkham/intellect.png" alt="Intellect" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      combat: '<img src="/icons/arkham/combat.png" alt="Combat" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      strength: '<img src="/icons/arkham/combat.png" alt="Combat" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      agility: '<img src="/icons/arkham/agility.png" alt="Agility" style="display:inline-block;width:1em;height:1em;vertical-align:middle;margin:0 1px;" />',
      // Font-based icons — local ArkhamIcons font
      wild: '<span style="font-family:ArkhamIcons;font-size:1em;">j</span>',
      action: '<span style="font-family:ArkhamIcons;font-size:1em;">t</span>',
      reaction: '<span style="font-family:ArkhamIcons;font-size:1em;">u</span>',
      free: '<span style="font-family:ArkhamIcons;font-size:1em;">v</span>',
      fast: '<span style="font-family:ArkhamIcons;font-size:1em;">v</span>',
      lightning: '<span style="font-family:ArkhamIcons;font-size:1em;">v</span>',
      skull: '<span style="font-family:ArkhamIcons;font-size:1em;">m</span>',
      cultist: '<span style="font-family:ArkhamIcons;font-size:1em;">n</span>',
      tablet: '<span style="font-family:ArkhamIcons;font-size:1em;">o</span>',
      elder_thing: '<span style="font-family:ArkhamIcons;font-size:1em;">p</span>',
      auto_fail: '<span style="font-family:ArkhamIcons;font-size:1em;">q</span>',
      elder_sign: '<span style="font-family:ArkhamIcons;font-size:1em;">k</span>',
      eldersign: '<span style="font-family:ArkhamIcons;font-size:1em;">k</span>',
      bless: '<span style="font-family:ArkhamIcons;font-size:1em;">z</span>',
      curse: '<span style="font-family:ArkhamIcons;font-size:1em;">y</span>',
      frost: '<span style="font-family:ArkhamIcons;font-size:1em;">&#xe900;</span>',
      per_investigator: '<span style="font-family:ArkhamIcons;font-size:1em;">r</span>',
      unique: '<span style="color:#fbbf24;">★</span>',
    };
    return map[iconName] || null;
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    const plainText = e.clipboardData.getData('text/plain');

    // Check if plain text has bracket icons worth converting
    const hasBracketIcons = enableArkhamCardTooltips && /\[\w+\]/.test(plainText || '');

    if (!html && !hasBracketIcons) return; // Let plain text paste through normally

    e.preventDefault();

    let cleanedHtml: string;

    if (html) {
      // Parse and strip color-related styles from pasted HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const stripColors = (el: Element) => {
        if (el instanceof HTMLElement && el.style) {
          el.style.color = '';
          el.style.backgroundColor = '';
          el.style.background = '';
          if (!el.getAttribute('style')?.trim()) {
            el.removeAttribute('style');
          }
        }
        el.querySelectorAll('*').forEach(child => {
          if (child instanceof HTMLElement && child.style) {
            child.style.color = '';
            child.style.backgroundColor = '';
            child.style.background = '';
            if (!child.getAttribute('style')?.trim()) {
              child.removeAttribute('style');
            }
          }
        });
        // Also remove <font> tags' color attribute (legacy HTML from Word etc.)
        el.querySelectorAll('font').forEach(font => {
          font.removeAttribute('color');
        });
      };

      stripColors(doc.body);

      // Make all links open in new tab
      doc.body.querySelectorAll('a[href]').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });

      // Replace ArkhamDB icon spans with our local icons
      if (enableArkhamCardTooltips) {
        doc.body.querySelectorAll('[class*="icon-"]').forEach(el => {
          const classes = (el.getAttribute('class') || '').split(/\s+/);
          const iconClass = classes.find(c => c.startsWith('icon-'));
          if (iconClass) {
            const iconName = iconClass.replace('icon-', '');
            const replacement = getLocalIconHtml(iconName);
            if (replacement) {
              const temp = doc.createElement('span');
              temp.innerHTML = replacement;
              el.replaceWith(...Array.from(temp.childNodes));
            }
          }
        });
      }

      cleanedHtml = doc.body.innerHTML;
    } else {
      // Plain text — escape HTML, then convert newlines
      cleanedHtml = (plainText || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    // Convert [iconname] bracket notation to local icons
    if (enableArkhamCardTooltips) {
      cleanedHtml = cleanedHtml.replace(/\[(\w+)\]/g, (match, name) => {
        const lower = name.toLowerCase();
        const replacement = getLocalIconHtml(lower);
        return replacement || match;
      });
    }

    // Insert cleaned HTML at cursor position
    document.execCommand('insertHTML', false, cleanedHtml);
  }, [enableArkhamCardTooltips, getLocalIconHtml]);

  // No-op during typing - we only sync on blur to prevent cursor jumping
  const handlePreviewInput = useCallback(() => {
    // Content is synced on blur only - this prevents cursor jumping
    // during editing by avoiding React state updates while typing
  }, []);

  // Update preview content when value changes externally (templates, undo, mode switch)
  // NEVER update while user is actively editing
  useEffect(() => {
    if (previewRef.current && showPreview && !isEditingRef.current) {
      // Only update if value changed externally (not from blur sync)
      if (value !== lastExternalValueRef.current) {
        previewRef.current.innerHTML = value || '';
        lastExternalValueRef.current = value;
      }
    }
  }, [value, showPreview]);

  // Set initial content when switching to preview mode
  useEffect(() => {
    if (previewRef.current && showPreview) {
      previewRef.current.innerHTML = value || '';
      lastExternalValueRef.current = value;
    }
  }, [showPreview]);

  // Apply formatting in visual editor mode
  const applyFormat = useCallback((command: string, formatValue?: string) => {
    // Ensure the editor has focus before executing command
    if (previewRef.current) {
      previewRef.current.focus();
    }
    document.execCommand(command, false, formatValue);
    // Sync content after applying format from toolbar
    if (previewRef.current) {
      const newContent = previewRef.current.innerHTML;
      lastExternalValueRef.current = newContent;
      onChange(newContent);
    }
  }, [onChange]);

  // Store selection before clicking toolbar buttons
  const savedSelectionRef = useRef<Range | null>(null);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelectionRef.current && previewRef.current) {
      previewRef.current.focus();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  }, []);

  // Apply block formatting (H1, H2, H3, P, blockquote)
  const applyBlockFormat = useCallback((tag: string) => {
    if (!previewRef.current) return;

    restoreSelection();

    // formatBlock needs the tag wrapped in angle brackets
    const formattedTag = tag.startsWith('<') ? tag : `<${tag}>`;
    document.execCommand('formatBlock', false, formattedTag);

    // Sync content
    const newContent = previewRef.current.innerHTML;
    lastExternalValueRef.current = newContent;
    onChange(newContent);
  }, [onChange, restoreSelection]);

  // Change font size — uses execCommand fontSize (1-7 scale) in visual mode
  const changeFontSize = useCallback((direction: 'increase' | 'decrease') => {
    if (!previewRef.current) return;

    restoreSelection();

    if (showPreview) {
      // Get current fontSize (1-7, default 3)
      const current = parseInt(document.queryCommandValue('fontSize') || '3', 10) || 3;
      const next = direction === 'increase'
        ? Math.min(7, current + 1)
        : Math.max(1, current - 1);
      document.execCommand('fontSize', false, String(next));

      // Sync content
      const newContent = previewRef.current.innerHTML;
      lastExternalValueRef.current = newContent;
      onChange(newContent);
    }
  }, [showPreview, onChange, restoreSelection]);

  // Insert list
  const insertList = useCallback((ordered: boolean) => {
    if (!previewRef.current) return;

    restoreSelection();

    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);

    // Sync content
    const newContent = previewRef.current.innerHTML;
    lastExternalValueRef.current = newContent;
    onChange(newContent);
  }, [onChange, restoreSelection]);

  // Align each line separately
  const alignLines = useCallback((alignment: 'left' | 'center' | 'right') => {
    if (showPreview && previewRef.current) {
      // In visual mode, use execCommand
      document.execCommand('justify' + alignment.charAt(0).toUpperCase() + alignment.slice(1), false);
      // Sync content after applying alignment from toolbar
      const newContent = previewRef.current.innerHTML;
      lastExternalValueRef.current = newContent;
      onChange(newContent);
    } else {
      // In code mode, wrap each selected line
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      if (!selectedText) {
        // No selection, insert placeholder
        const alignedText = `<p style="text-align: ${alignment};">Aligned text</p>`;
        const newValue = value.substring(0, start) + alignedText + value.substring(end);
        onChange(newValue);
        return;
      }

      // Split by newlines and wrap each line
      const lines = selectedText.split('\n');
      const alignedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        return `<p style="text-align: ${alignment};">${trimmed}</p>`;
      }).filter(Boolean).join('\n');

      const newValue = value.substring(0, start) + alignedLines + value.substring(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + alignedLines.length);
      }, 0);
    }
  }, [showPreview, value, onChange]);

  const insertTag = useCallback((openTag: string, closeTag: string, placeholder?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholder || '';

    const newValue =
      value.substring(0, start) +
      openTag + textToInsert + closeTag +
      value.substring(end);

    onChange(newValue);

    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + openTag.length + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newValue = value.substring(0, start) + text + value.substring(start);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, [value, onChange]);

  const toolbarButtons = [
    {
      group: 'history',
      items: [
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          ),
          title: 'Undo (Ctrl+Z)',
          action: () => showPreview ? document.execCommand('undo') : undo(),
          disabled: !showPreview && historyIndex <= 0
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          ),
          title: 'Redo (Ctrl+Shift+Z)',
          action: () => showPreview ? document.execCommand('redo') : redo(),
          disabled: historyIndex >= history.length - 1
        },
      ]
    },
    {
      group: 'text',
      items: [
        {
          icon: 'B',
          title: 'Bold (Ctrl+B)',
          action: () => showPreview ? applyFormat('bold') : insertTag('<strong>', '</strong>', 'bold text'),
          className: 'font-bold'
        },
        {
          icon: 'I',
          title: 'Italic (Ctrl+I)',
          action: () => showPreview ? applyFormat('italic') : insertTag('<em>', '</em>', 'italic text'),
          className: 'italic'
        },
        {
          icon: 'U',
          title: 'Underline (Ctrl+U)',
          action: () => showPreview ? applyFormat('underline') : insertTag('<u>', '</u>', 'underlined text'),
          className: 'underline'
        },
      ]
    },
    {
      group: 'size',
      items: [
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          ),
          title: 'Increase text size',
          action: () => showPreview
            ? changeFontSize('increase')
            : insertTag('<span style="font-size: larger;">', '</span>', 'larger text'),
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          ),
          title: 'Decrease text size',
          action: () => showPreview
            ? changeFontSize('decrease')
            : insertTag('<span style="font-size: smaller;">', '</span>', 'smaller text'),
        },
      ]
    },
    {
      group: 'headings',
      items: [
        {
          icon: 'H1',
          title: 'Heading 1 — largest heading',
          action: () => showPreview ? applyBlockFormat('h1') : insertTag('<h1>', '</h1>', 'Heading'),
          className: 'text-sm font-extrabold leading-none'
        },
        {
          icon: 'H2',
          title: 'Heading 2 — section heading',
          action: () => showPreview ? applyBlockFormat('h2') : insertTag('<h2>', '</h2>', 'Heading'),
          className: 'text-xs font-bold leading-none'
        },
        {
          icon: 'H3',
          title: 'Heading 3 — subsection heading',
          action: () => showPreview ? applyBlockFormat('h3') : insertTag('<h3>', '</h3>', 'Heading'),
          className: 'text-[11px] font-bold leading-none'
        },
        {
          icon: 'P',
          title: 'Normal paragraph text',
          action: () => showPreview ? applyBlockFormat('p') : insertTag('<p>', '</p>', 'Paragraph text'),
          className: 'text-[11px] leading-none'
        },
      ]
    },
    {
      group: 'alignment',
      items: [
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
            </svg>
          ),
          title: 'Align Left',
          action: () => alignLines('left')
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
            </svg>
          ),
          title: 'Align Center',
          action: () => alignLines('center')
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
            </svg>
          ),
          title: 'Align Right',
          action: () => alignLines('right')
        },
      ]
    },
    {
      group: 'blocks',
      items: [
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          ),
          title: 'Bullet List',
          action: () => showPreview ? insertList(false) : insertAtCursor('<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n  <li>Item 3</li>\n</ul>')
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          ),
          title: 'Numbered List',
          action: () => showPreview ? insertList(true) : insertAtCursor('<ol>\n  <li>First item</li>\n  <li>Second item</li>\n  <li>Third item</li>\n</ol>')
        },
      ]
    },
    {
      group: 'insert',
      items: [
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
          title: 'Link',
          action: () => {
            if (showPreview) {
              const url = prompt('Enter URL:', 'https://');
              if (url) {
                applyFormat('createLink', url);
              }
            } else {
              insertTag('<a href="https://">', '</a>', 'link text');
            }
          }
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 20L20 4" />
            </svg>
          ),
          title: 'Remove link',
          action: () => {
            if (showPreview) {
              restoreSelection();
              document.execCommand('unlink', false);
              if (previewRef.current) {
                const newContent = previewRef.current.innerHTML;
                lastExternalValueRef.current = newContent;
                onChange(newContent);
              }
            }
          }
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          ),
          title: 'Horizontal Rule',
          action: () => showPreview ? applyFormat('insertHorizontalRule') : insertAtCursor('\n<hr />\n')
        },
        {
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          ),
          title: 'Blockquote',
          action: () => showPreview ? applyBlockFormat('blockquote') : insertTag('<blockquote>', '</blockquote>', 'Quote text')
        },
      ]
    },
  ];

  const templates = [
    {
      name: 'Deck Guide',
      content: `<h1>Deck Name — Investigator Name</h1>

<p><em>A brief thematic tagline for the deck.</em></p>

<hr>

<h2>Overview</h2>

<table>
  <tbody>
    <tr><td>Difficulty:</td><td>★★☆☆☆</td></tr>
    <tr><td>Enemy Management:</td><td>★★☆☆☆</td></tr>
    <tr><td>Clue-getting:</td><td>★★★★☆</td></tr>
    <tr><td>Encounter Protection:</td><td>★★★☆☆</td></tr>
    <tr><td>Survivability:</td><td>★★★☆☆</td></tr>
    <tr><td>Economy:</td><td>★★★☆☆</td></tr>
    <tr><td>Card Draw:</td><td>★★★☆☆</td></tr>
  </tbody>
</table>

<hr>

<h2>Introduction</h2>
<p>Describe the deck concept, what inspired it, and what campaign or player count it's designed for.</p>

<hr>

<h2>Main Strategy</h2>
<ul>
  <li>Key combo or engine piece #1</li>
  <li>Key combo or engine piece #2</li>
  <li>Key combo or engine piece #3</li>
</ul>

<hr>

<h2>Card Choices</h2>
<p>Walk through the important cards in the deck and explain why each one is included.</p>

<h3>Assets</h3>
<p>Explain the core assets and how they work together.</p>

<h3>Events</h3>
<p>Explain the key events and when to play them.</p>

<h3>Skills</h3>
<p>Explain the skill card choices and commit strategy.</p>

<hr>

<h2>Upgrade Path</h2>
<p><strong>Early Campaign (0-10 XP)</strong></p>
<ul>
  <li>First priority upgrade</li>
  <li>Second priority upgrade</li>
</ul>

<p><strong>Mid Campaign (10-25 XP)</strong></p>
<ul>
  <li>Mid-game upgrades</li>
</ul>

<p><strong>Late Campaign (25+ XP)</strong></p>
<ul>
  <li>Luxury upgrades</li>
</ul>

<hr>

<h2>Mulligan Priority</h2>
<ol>
  <li>Must-keep card</li>
  <li>High priority card</li>
  <li>Nice to have</li>
</ol>

<hr>

<h2>Final Thoughts</h2>
<p>Closing remarks, alternative card suggestions, and tips for adapting the deck.</p>`
    },
    {
      name: 'Strategy Notes',
      content: `<h1>Strategy Notes</h1>

<h2>Scenario Tips</h2>
<p>Notes on how the deck handles specific scenarios or encounter sets.</p>

<h3>Act 1</h3>
<p>Early game priorities and setup actions.</p>

<h3>Act 2</h3>
<p>Mid-game strategy and key decision points.</p>

<h3>Act 3</h3>
<p>End-game push and win conditions.</p>

<hr>

<h2>Piloting Guide</h2>

<p><strong>Turn 1 Priority:</strong></p>
<ol>
  <li>Play key asset</li>
  <li>Draw or gain resources</li>
  <li>Investigate or move into position</li>
</ol>

<p><strong>Ideal Board State:</strong></p>
<ul>
  <li>Asset #1 in play</li>
  <li>Asset #2 in play</li>
  <li>Ready to handle enemies or clues</li>
</ul>

<hr>

<h2>Weaknesses &amp; Counters</h2>
<p><strong>Investigator Weakness:</strong> How to handle it when it appears.</p>
<p><strong>Basic Weakness:</strong> Notes on mitigating the random basic weakness.</p>

<hr>

<h2>Teammate Synergies</h2>
<ul>
  <li><strong>Guardians:</strong> How this deck works alongside a fighter</li>
  <li><strong>Seekers:</strong> Clue-getting overlap or support</li>
  <li><strong>Other:</strong> Any specific investigator pairings that shine</li>
</ul>`
    },
    {
      name: 'Campaign Log',
      content: `<h1>Campaign Log — Campaign Name</h1>

<p><strong>Investigators:</strong> Investigator 1, Investigator 2</p>
<p><strong>Difficulty:</strong> Standard / Hard / Expert</p>

<hr>

<h2>Scenario 1 — Scenario Name</h2>
<p><strong>Result:</strong> Resolution X</p>
<p><strong>XP Earned:</strong> X</p>
<p><strong>Trauma:</strong> None</p>

<p><strong>Notes:</strong></p>
<p>What happened, key moments, and lessons learned.</p>

<p><strong>Upgrades Purchased:</strong></p>
<ul>
  <li>Card A (X XP)</li>
  <li>Card B (X XP)</li>
</ul>

<hr>

<h2>Scenario 2 — Scenario Name</h2>
<p><strong>Result:</strong> Resolution X</p>
<p><strong>XP Earned:</strong> X</p>
<p><strong>Trauma:</strong> None</p>

<p><strong>Notes:</strong></p>
<p>What happened, key moments, and lessons learned.</p>

<p><strong>Upgrades Purchased:</strong></p>
<ul>
  <li>Card A (X XP)</li>
  <li>Card B (X XP)</li>
</ul>

<hr>

<h2>Scenario 3 — Scenario Name</h2>
<p><strong>Result:</strong> Resolution X</p>
<p><strong>XP Earned:</strong> X</p>
<p><strong>Trauma:</strong> None</p>

<p><strong>Notes:</strong></p>
<p>What happened, key moments, and lessons learned.</p>

<p><strong>Upgrades Purchased:</strong></p>
<ul>
  <li>Card A (X XP)</li>
  <li>Card B (X XP)</li>
</ul>`
    }
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
        {toolbarButtons.map((group, groupIndex) => (
          <div key={group.group} className="flex items-center">
            {groupIndex > 0 && (
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
            )}
            {group.items.map((button, index) => (
              <button
                key={index}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                }}
                onClick={button.action}
                disabled={'disabled' in button ? button.disabled : false}
                className={`p-2 rounded transition-colors ${'className' in button ? button.className : ''} ${
                  'disabled' in button && button.disabled
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
                title={button.title}
              >
                {button.icon}
              </button>
            ))}
          </div>
        ))}

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Templates dropdown */}
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Templates
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            {templates.map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => onChange(template.content)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1" />

        {/* Mode toggle */}
        <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showPreview
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Visual
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !showPreview
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Code
          </button>
        </div>
      </div>

      {/* Editor Styles */}
      <style>{`
        .rich-editor h1 { font-size: 2rem; font-weight: 800; margin: 1.25rem 0 0.5rem; line-height: 1.2; }
        .rich-editor h2 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; line-height: 1.3; }
        .rich-editor h3 { font-size: 1.2rem; font-weight: 600; margin: 0.75rem 0 0.375rem; line-height: 1.3; }
        .rich-editor p { margin: 0.5rem 0; }
        .rich-editor ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .rich-editor ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .rich-editor li { margin: 0.25rem 0; }
        .rich-editor blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; margin: 0.5rem 0; font-style: italic; color: #6b7280; }
        .rich-editor a { color: #3b82f6; text-decoration: underline; }
        .rich-editor strong { font-weight: 700; }
        .rich-editor em { font-style: italic; }
        .rich-editor u { text-decoration: underline; }
        .rich-editor hr { border: none; border-top: 1px solid #d1d5db; margin: 1rem 0; }
        .dark .rich-editor h1 { color: #fff; }
        .dark .rich-editor h2 { color: #f3f4f6; }
        .dark .rich-editor h3 { color: #e5e7eb; }
        .dark .rich-editor blockquote { border-color: #4b5563; color: #9ca3af; }
        .dark .rich-editor hr { border-color: #4b5563; }
        .rich-editor font[size="1"] { font-size: 0.625rem; }
        .rich-editor font[size="2"] { font-size: 0.8rem; }
        .rich-editor font[size="3"] { font-size: 1rem; }
        .rich-editor font[size="4"] { font-size: 1.2rem; }
        .rich-editor font[size="5"] { font-size: 1.5rem; }
        .rich-editor font[size="6"] { font-size: 2rem; }
        .rich-editor font[size="7"] { font-size: 2.5rem; }
      `}</style>

      {/* ArkhamDB icon font styles */}
      {enableArkhamCardTooltips && (
        <style>{`
          @font-face {
            font-family: 'thronesdb';
            src: url('https://arkhamdb.com/bundles/app/fonts/arkham-icons.woff') format('woff'),
                 url('https://arkhamdb.com/bundles/app/fonts/arkham-icons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          .rich-editor [class^="icon-"], .rich-editor [class*=" icon-"] {
            font-family: 'thronesdb';
            speak: none;
            font-style: normal;
            font-weight: normal;
            font-variant: normal;
            text-transform: none;
            line-height: 1;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          .rich-editor .icon-reaction:before { content: "!"; }
          .rich-editor .icon-fast:before, .rich-editor .icon-free:before, .rich-editor .icon-lightning:before { content: "j"; }
          .rich-editor .icon-eldersign:before, .rich-editor .icon-elder_sign:before { content: "o"; }
          .rich-editor .icon-action:before { content: "i"; }
          .rich-editor .icon-strength:before, .rich-editor .icon-combat:before { content: "c"; }
          .rich-editor .icon-agility:before { content: "a"; }
          .rich-editor .icon-will:before, .rich-editor .icon-willpower:before { content: "p"; }
          .rich-editor .icon-lore:before, .rich-editor .icon-intellect:before { content: "b"; }
          .rich-editor .icon-wild:before { content: "?"; font-weight: bold; padding-right: 2px; }
          .rich-editor .icon-unique:before { content: "s"; font-size: 1.1em; }
          .rich-editor .icon-elder_thing:before { content: "n"; }
          .rich-editor .icon-skull:before { content: "k"; }
          .rich-editor .icon-frost:before { content: "x"; }
          .rich-editor .icon-seal_a:before { content: "1"; }
          .rich-editor .icon-seal_b:before { content: "2"; }
          .rich-editor .icon-seal_c:before { content: "3"; }
          .rich-editor .icon-seal_d:before { content: "4"; }
          .rich-editor .icon-seal_e:before { content: "5"; }
          .rich-editor .icon-auto_fail:before { content: "m"; }
          .rich-editor .icon-cultist:before { content: "l"; }
          .rich-editor .icon-tablet:before { content: "q"; }
          .rich-editor .icon-bless:before { content: "v"; }
          .rich-editor .icon-curse:before { content: "w"; }
          .rich-editor .icon-per_investigator:before { content: "u"; vertical-align: top; font-size: 12px; }
          .rich-editor .icon-null:before { content: "t"; }
          .rich-editor .icon-guardian { background-image: url("https://arkhamdb.com/bundles/app/images/factions/guardian.png"); background-repeat: no-repeat; width: 16px; height: 16px; display: inline-block; vertical-align: top; margin-top: 1px; }
          .rich-editor .icon-mystic { background-image: url("https://arkhamdb.com/bundles/app/images/factions/mystic.png"); background-repeat: no-repeat; width: 16px; height: 16px; display: inline-block; vertical-align: top; margin-top: 1px; }
          .rich-editor .icon-seeker { background-image: url("https://arkhamdb.com/bundles/app/images/factions/seeker.png"); background-repeat: no-repeat; width: 16px; height: 16px; display: inline-block; vertical-align: top; margin-top: 1px; }
          .rich-editor .icon-rogue { background-image: url("https://arkhamdb.com/bundles/app/images/factions/rogue.png"); background-repeat: no-repeat; width: 16px; height: 16px; display: inline-block; vertical-align: top; margin-top: 1px; }
          .rich-editor .icon-survivor { background-image: url("https://arkhamdb.com/bundles/app/images/factions/survivor.png"); background-repeat: no-repeat; width: 16px; height: 16px; display: inline-block; vertical-align: top; margin-top: -1px; }
        `}</style>
      )}

      {/* Editor / Preview */}
      <div className="flex-1 min-h-0">
        {showPreview ? (
          <div className="h-full overflow-auto bg-white dark:bg-gray-900 rounded-b-lg border border-t-0 border-gray-200 dark:border-gray-700">
            <div
              ref={previewRef}
              contentEditable
              onInput={handlePreviewInput}
              onBlur={handlePreviewBlur}
              onFocus={handlePreviewFocus}
              onPaste={handlePaste}
              className="rich-editor min-h-full p-6 text-gray-900 dark:text-gray-100 focus:outline-none cursor-text"
              data-placeholder={placeholder || 'Start typing your content here...'}
              style={{ minHeight: '100%' }}
              suppressContentEditableWarning
            />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full p-4 font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder={placeholder || 'Start typing your content here...\n\nUse the toolbar above to format your text, or type HTML directly.'}
            spellCheck={false}
          />
        )}
      </div>

      {/* Arkham card tooltip portal */}
      {enableArkhamCardTooltips && tooltip && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            zIndex: 10000,
            width: 250,
            pointerEvents: 'auto',
            opacity: imageLoaded || imageError ? 1 : 0,
            transition: 'opacity 150ms ease-in-out',
          }}
        >
          <div className="rounded-lg overflow-hidden shadow-2xl border border-gray-600/50 bg-gray-900">
            {!imageError ? (
              <img
                src={tooltip.imageUrl}
                alt="Card preview"
                onLoad={() => setImageLoaded(true)}
                onError={handleImageError}
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Card image not available
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
