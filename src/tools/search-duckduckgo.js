import * as cheerio from 'cheerio';

/**
 * Factory to create the DuckDuckGo Search Tool.
 * Implements Dependency Injection of the Tor-routed fetch client.
 * 
 * @param {Object} params
 * @param {Function} params.torFetch The configured Tor fetch client
 * @returns {Object} The tool definition and executor
 */
export function createSearchDuckDuckGoTool({ torFetch }) {
  if (!torFetch) {
    throw new Error('createSearchDuckDuckGoTool: torFetch client is required.');
  }

  const ONION_BASE_URL = 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/html/';
  const CLEARNET_BASE_URL = 'https://html.duckduckgo.com/html/';

  /**
   * Internal parser for DuckDuckGo's HTML search results.
   * Pure function.
   * 
   * @param {string} html 
   * @returns {Array<Object>}
   */
  function parseResults(html) {
    const $ = cheerio.load(html);
    const results = [];

    $('.result').each((_, element) => {
      const titleLink = $(element).find('.result__a').first();
      const title = titleLink.text().trim();
      const rawHref = titleLink.attr('href');
      const description = $(element).find('.result__snippet').first().text().trim();

      if (title && rawHref) {
        // Resolve DuckDuckGo redirect URLs if present
        let href = rawHref;
        if (rawHref.includes('uddg=')) {
          try {
            const urlParts = new URL(rawHref, 'https://duckduckgo.com');
            const uddg = urlParts.searchParams.get('uddg');
            if (uddg) {
              href = decodeURIComponent(uddg);
            }
          } catch (e) {
            // Keep original href if URL parsing fails
          }
        }
        results.push({ title, href, description });
      }
    });

    return results;
  }

  return {
    name: 'search_duckduckgo',
    description: 'Searches the web via DuckDuckGo Tor onion service. Useful for general research, finding public indexes, articles, or resources that are indexed by search engines. Returns a list of titles, URLs, and snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords or phrase.'
        },
        useClearnetFallback: {
          type: 'boolean',
          description: 'If true, queries the HTML clearnet version of DuckDuckGo over Tor SOCKS5 if the onion service fails.'
        }
      },
      required: ['query']
    },

    /**
     * Executes the search.
     */
    async execute({ query, useClearnetFallback = true }) {
      if (!query || query.trim() === '') {
        return 'Error: Search query cannot be empty.';
      }

      const encodedQuery = encodeURIComponent(query);
      const onionUrl = `${ONION_BASE_URL}?q=${encodedQuery}`;

      try {
        console.log(`[Tor Agent] Searching DuckDuckGo Onion: ${onionUrl}`);
        const response = await torFetch(onionUrl, { timeout: 15000 });

        if (!response.ok) {
          throw new Error(`Onion Search failed with status ${response.status}`);
        }

        const html = await response.text();
        const results = parseResults(html);

        if (results.length === 0) {
          return 'No results found on DuckDuckGo Onion.';
        }

        return JSON.stringify(results.slice(0, 10), null, 2);
      } catch (onionError) {
        console.warn(`[Tor Agent] DuckDuckGo Onion search failed: ${onionError.message}`);

        if (!useClearnetFallback) {
          return `Error: Onion search failed: ${onionError.message}`;
        }

        const clearnetUrl = `${CLEARNET_BASE_URL}?q=${encodedQuery}`;
        try {
          console.log(`[Tor Agent] Falling back to DuckDuckGo Clearnet over Tor: ${clearnetUrl}`);
          const response = await torFetch(clearnetUrl, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0'
            }
          });

          if (!response.ok) {
            throw new Error(`Clearnet Search failed with status ${response.status}`);
          }

          const html = await response.text();
          const results = parseResults(html);

          if (results.length === 0) {
            return 'No results found on DuckDuckGo (clearnet fallback).';
          }

          return JSON.stringify(results.slice(0, 10), null, 2);
        } catch (clearnetError) {
          return `Error: Both DuckDuckGo Onion and Clearnet search queries failed. Onion: ${onionError.message}. Clearnet: ${clearnetError.message}`;
        }
      }
    }
  };
}
