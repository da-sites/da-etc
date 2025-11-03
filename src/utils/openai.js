export default async function extractTags({ html, env }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: 'Extract 5-10 relevant keywords or tags from the provided text. Return only a JSON array of keywords.'
        },
        {
          role: 'user',
          content: html.substring(0, 4000)
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "keyword_extraction",
          schema: {
            type: "object",
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                minItems: 5,
                maxItems: 10
              }
            },
            required: ["tags"],
            additionalProperties: false
          }
        }
      }
    })
  });

  const data = await response.json();
  console.log(data);
  return JSON.parse(data.choices[0].message.content);
}