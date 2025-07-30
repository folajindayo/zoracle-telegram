/**
 * Utility functions for Telegram messaging
 */

/**
 * Escapes special characters for Telegram's MarkdownV2 format
 * @param text Text to escape
 * @returns Escaped text safe for MarkdownV2
 */
export function escapeMarkdown(text: string): string {
  // Characters that need to be escaped in MarkdownV2:
  // '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
  return text.replace(/([_*[\]()~`>#+=|{}.!\\])/g, '\\$1');
}

/**
 * Converts Markdown formatting to HTML
 * @param text Text with Markdown formatting
 * @returns Text with HTML formatting
 */
export function markdownToHtml(text: string): string {
  // Convert Markdown formatting to HTML
  // Bold: *text* -> <b>text</b>
  text = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
  
  // Italic: _text_ -> <i>text</i>
  text = text.replace(/_(.*?)_/g, '<i>$1</i>');
  
  // Code: `text` -> <code>text</code>
  text = text.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Links: [text](url) -> <a href="url">text</a>
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
  
  return text;
}

/**
 * Escapes special characters for Telegram's MarkdownV2 format, but preserves 
 * existing Markdown formatting like *bold*, _italic_, `code`, [links](url)
 * @param text Text with Markdown to preserve
 * @returns Properly escaped text that maintains intended formatting
 */
export function escapeMarkdownPreserveFormat(text: string): string {
  // This is a simplified version - for complex markdown, consider a proper parser
  
  // First, temporarily replace valid markdown constructs
  const placeholders: Record<string, string> = {};
  let counter = 0;
  
  // Save code blocks
  text = text.replace(/`([^`]+)`/g, (match) => {
    const placeholder = `__CODE_BLOCK_${counter}__`;
    placeholders[placeholder] = match;
    counter++;
    return placeholder;
  });
  
  // Save links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
    const placeholder = `__LINK_${counter}__`;
    placeholders[placeholder] = match;
    counter++;
    return placeholder;
  });
  
  // Save bold text
  text = text.replace(/\*([^*]+)\*/g, (match) => {
    const placeholder = `__BOLD_${counter}__`;
    placeholders[placeholder] = match;
    counter++;
    return placeholder;
  });
  
  // Save italic text
  text = text.replace(/_([^_]+)_/g, (match) => {
    const placeholder = `__ITALIC_${counter}__`;
    placeholders[placeholder] = match;
    counter++;
    return placeholder;
  });
  
  // Escape all special characters
  text = escapeMarkdown(text);
  
  // Restore placeholders, but properly escape their content
  Object.keys(placeholders).forEach(placeholder => {
    let replacement = placeholders[placeholder];
    
    if (placeholder.startsWith('__CODE_BLOCK_')) {
      // For code blocks, escape the content but keep the backticks
      const content = replacement.substring(1, replacement.length - 1);
      replacement = '`' + escapeMarkdown(content) + '`';
    } 
    else if (placeholder.startsWith('__LINK_')) {
      // For links, handle text and URL separately
      const linkText = replacement.match(/\[([^\]]+)\]/)[1];
      const linkUrl = replacement.match(/\(([^)]+)\)/)[1];
      replacement = '[' + escapeMarkdown(linkText) + '](' + escapeMarkdown(linkUrl) + ')';
    }
    else if (placeholder.startsWith('__BOLD_')) {
      // For bold text
      const content = replacement.substring(1, replacement.length - 1);
      replacement = '*' + escapeMarkdown(content) + '*';
    }
    else if (placeholder.startsWith('__ITALIC_')) {
      // For italic text
      const content = replacement.substring(1, replacement.length - 1);
      replacement = '_' + escapeMarkdown(content) + '_';
    }
    
    text = text.replace(placeholder, replacement);
  });
  
  return text;
}