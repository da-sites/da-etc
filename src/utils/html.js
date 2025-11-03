import { decode } from "html-entities";

export default function cleanHtml(html) {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities (e.g., &amp; → &, &lt; → <, &quot; → ")
  text = decode(text);

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}