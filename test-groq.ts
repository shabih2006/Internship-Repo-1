import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const apiKey = process.env.GROQ_API_KEY?.trim();
const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (!apiKey) {
  console.error('GROQ_API_KEY is missing from .env');
  process.exit(1);
}

async function testGroq(): Promise<void> {
  console.log(`Testing Groq model: ${model}`);

  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly: Groq API is working.',
      },
    ],
    temperature: 1,
    max_completion_tokens: 2048,
    top_p: 1,
    stream: true,
  });

  let text = '';
  for await (const chunk of response) {
    text += chunk.choices[0]?.delta?.content || '';
  }

  if (!text.trim()) {
    throw new Error('Groq returned an empty response.');
  }

  console.log('Groq response:');
  console.log(text.trim());
}

testGroq().catch((error: unknown) => {
  console.error('Groq API test failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});