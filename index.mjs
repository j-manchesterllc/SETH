import { streamText } from 'ai'

const result = streamText({
  model: 'anthropic/claude-sonnet-4-5',
  prompt: 'Explain quantum computing in simple terms.',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
