import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import type { ToolDefinition, ToolResult } from '../agent/types';

export class WebFetchTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'WebFetch',
      description: 'Fetch content from a URL. Use this to read the content of web pages, APIs, or any accessible URL. Returns the text content of the page.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch content from',
          },
          max_length: {
            type: 'number',
            description: 'Maximum number of characters to return (default: 50000)',
            default: 50000,
          },
        },
        required: ['url'],
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const url = input.url as string;
    const maxLength = (input.max_length as number) || 50000;

    if (!url) {
      return {
        tool_use_id: '',
        content: 'Error: URL is required',
        is_error: true,
      };
    }

    try {
      // Validate URL
      new URL(url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Enterprise-CLI/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          tool_use_id: '',
          content: `Error: HTTP ${response.status} - ${response.statusText}`,
          is_error: true,
        };
      }

      let content = await response.text();

      // Truncate if too long
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n[Content truncated - exceeded max_length]';
      }

      // Basic HTML stripping
      content = this.stripHtml(content);

      return {
        tool_use_id: '',
        content: `Fetched from: ${url}\n\n${content}`,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          tool_use_id: '',
          content: 'Error: Request timed out after 30 seconds',
          is_error: true,
        };
      }
      return {
        tool_use_id: '',
        content: `Error fetching URL: ${error.message}`,
        is_error: true,
      };
    }
  }

  private stripHtml(html: string): string {
    // Simple HTML tag removal
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, '\n');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    // Remove excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
    return text;
  }
}

export class WebSearchTool {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  get definition(): ToolDefinition {
    return {
      name: 'WebSearch',
      description: 'Search the web for information. Use this to find recent information, documentation, or answers to questions that require up-to-date knowledge.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          num_results: {
            type: 'number',
            description: 'Number of results to return (default: 5)',
            default: 5,
          },
        },
        required: ['query'],
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const query = input.query as string;
    const numResults = (input.num_results as number) || 5;

    if (!query) {
      return {
        tool_use_id: '',
        content: 'Error: Query is required',
        is_error: true,
      };
    }

    try {
      // Use DuckDuckGo HTML search (no API key needed)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        return {
          tool_use_id: '',
          content: `Error: Search failed with status ${response.status}`,
          is_error: true,
        };
      }

      const html = await response.text();
      const results = this.parseSearchResults(html, numResults);

      if (results.length === 0) {
        return {
          tool_use_id: '',
          content: `No results found for: ${query}`,
        };
      }

      const formatted = results.map((r, i) => 
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      ).join('\n\n');

      return {
        tool_use_id: '',
        content: `Search results for: "${query}"\n\n${formatted}`,
      };
    } catch (error: any) {
      return {
        tool_use_id: '',
        content: `Error performing search: ${error.message}`,
        is_error: true,
      };
    }
  }

  private parseSearchResults(html: string, limit: number): Array<{title: string; url: string; snippet: string}> {
    const results: Array<{title: string; url: string; snippet: string}> = [];
    
    // Simple regex-based parsing (DDG HTML format)
    const resultRegex = /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__url"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    
    let match;
    while ((match = resultRegex.exec(html)) && results.length < limit) {
      results.push({
        title: this.stripHtml(match[2]).trim(),
        url: this.decodeUrl(match[1]),
        snippet: this.stripHtml(match[4] || '').trim(),
      });
    }
    
    return results;
  }

  private decodeUrl(url: string): string {
    // Decode DDG redirect URL
    if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
      return decodeURIComponent(url.split('uddg=')[1]?.split('&')[0] || url);
    }
    return url;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  }
}
