<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom"
                xmlns:media="http://search.yahoo.com/mrss/">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> - Live RSS Feed</title>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
        <style>
          :root {
            --bg-base: #0c0e14;
            --bg-surface: #121620;
            --bg-elevated: #181d2a;
            --border: #222938;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --accent: #3b82f6;
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --font-mono: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: var(--font-sans);
            padding: 2rem 1rem;
            line-height: 1.5;
          }
          .container {
            max-width: 860px;
            margin: 0 auto;
          }
          header {
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border);
          }
          .top-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.75rem;
            flex-wrap: wrap;
            gap: 0.75rem;
          }
          .brand {
            font-size: 0.8125rem;
            font-family: var(--font-mono);
            letter-spacing: 0.05em;
            color: var(--accent);
            text-transform: uppercase;
            font-weight: 700;
          }
          .back-link {
            font-size: 0.8125rem;
            color: var(--text-muted);
            text-decoration: none;
            padding: 0.35rem 0.75rem;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 4px;
            transition: all 0.15s;
          }
          .back-link:hover {
            color: var(--text-main);
            border-color: var(--accent);
          }
          h1 {
            font-size: 1.75rem;
            font-weight: 800;
            letter-spacing: -0.02em;
            margin-bottom: 0.5rem;
          }
          .subtitle {
            color: var(--text-muted);
            font-size: 0.9375rem;
          }
          .info-banner {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-left: 3px solid var(--accent);
            padding: 1rem 1.25rem;
            border-radius: 6px;
            margin-bottom: 2rem;
            font-size: 0.875rem;
            color: var(--text-muted);
          }
          .info-banner strong {
            color: var(--text-main);
          }
          .feed-url {
            display: inline-block;
            background: var(--bg-elevated);
            color: var(--accent);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-family: var(--font-mono);
            font-size: 0.8125rem;
            margin-top: 0.35rem;
            word-break: break-all;
          }
          .posts-list {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }
          .post-card {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.25rem 1.4rem;
            transition: border-color 0.15s, transform 0.15s;
          }
          .post-card:hover {
            border-color: var(--accent);
            transform: translateY(-1px);
          }
          .post-date {
            font-family: var(--font-mono);
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-bottom: 0.4rem;
            display: block;
          }
          .post-title {
            font-size: 1.15rem;
            font-weight: 700;
            margin-bottom: 0.6rem;
            line-height: 1.35;
          }
          .post-title a {
            color: var(--text-main);
            text-decoration: none;
          }
          .post-title a:hover {
            color: var(--accent);
          }
          .post-summary {
            color: var(--text-muted);
            font-size: 0.875rem;
            line-height: 1.5;
            margin-bottom: 0.85rem;
          }
          .read-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            font-size: 0.8125rem;
            font-weight: 600;
            color: var(--accent);
            text-decoration: none;
          }
          .read-btn:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="top-row">
              <span class="brand">Trade Opportunities // RSS Feed</span>
              <a href="/" class="back-link">&#8592; Back to Terminal Dashboard</a>
            </div>
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p class="subtitle"><xsl:value-of select="/rss/channel/description"/></p>
          </header>

          <div class="info-banner">
            <p><strong>Syndication Feed:</strong> You are viewing the live XML syndication feed. To subscribe in your favorite feed reader (e.g., Feedly, Inoreader, Newsblur, Apple Podcasts), copy the feed URL:</p>
            <span class="feed-url"><xsl:value-of select="/rss/channel/link"/>rss.xml</span>
          </div>

          <div class="posts-list">
            <xsl:for-each select="/rss/channel/item">
              <article class="post-card">
                <span class="post-date"><xsl:value-of select="pubDate"/></span>
                <h2 class="post-title">
                  <a>
                    <xsl:attribute name="href">
                      <xsl:value-of select="link"/>
                    </xsl:attribute>
                    <xsl:value-of select="title"/>
                  </a>
                </h2>
                <div class="post-summary">
                  <xsl:value-of select="description" disable-output-escaping="yes"/>
                </div>
                <a class="read-btn">
                  <xsl:attribute name="href">
                    <xsl:value-of select="link"/>
                  </xsl:attribute>
                  Read Full Dispatch &#8594;
                </a>
              </article>
            </xsl:for-each>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
