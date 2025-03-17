import Fastify, { FastifyRequest } from "fastify";
import path from "path";
import fs from "node:fs";
import { sync as globSync } from "glob";
import { redis, redisVectorStore } from "./redis-store";
import { ChatOpenAI } from "@langchain/openai"
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { config } from "dotenv"
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";


config()

const app = Fastify();

app.get("/", async () => {
  return { message: "Hello, Fastify + TypeScript + Zod + Biome!" };
});

app.get("/md-to-txt", async (request, reply) => {
  const srcDir = path.join(process.cwd(), "all");
  const destDir = path.join(process.cwd(), "all-txt");

  const mdFiles = globSync(`${srcDir}/**/*.md`);
  const pdfFiles = globSync(`${srcDir}/**/*.pdf`);

  const convertFile = (file: string, ext: string) => {
    const content = fs.readFileSync(file, "utf-8");

    const relativePath = path.relative(srcDir, file);

    const relativeTxtPath = relativePath.replace(new RegExp(`\\.${ext}$`), ".txt");

    const outputPath = path.join(destDir, relativeTxtPath);

    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(outputPath, content, "utf-8");
  };

  mdFiles.forEach((file) => convertFile(file, "md"));
  pdfFiles.forEach((file) => convertFile(file, "pdf"));

  return { message: "Conversão completa", filesConverted: mdFiles.length + pdfFiles.length };
});

app.post("/search", async (request: FastifyRequest<{ Body: { answer: string } }>, reply) => {
  try {
    const { answer } = request.body;

    const openAiChat = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      temperature: 0.3,
    });

    const prompt = ChatPromptTemplate.fromTemplate(`
      Você é um assistente virtual pessoal. Você funcionará como o segundo cérebro do usuário.
      O usuário pode fazer perguntas.
      Use o conteúdo das anotações para responder as perguntas.
      Se a resposta não for encontrada, responda que você não sabe. Não tente inventar respostas.

      **Anotações**:
      {context}

      **Pergunta**: {input}
    `.trim());

    const combineDocsChain = await createStuffDocumentsChain({
      llm: openAiChat,
      prompt,
    });

    const retriever = redisVectorStore.asRetriever();

    const retrievalChain = await createRetrievalChain({
      combineDocsChain,
      retriever,
    });

    await redis.connect();

    const response = await retrievalChain.invoke({
      input: answer,
    });

    await redis.disconnect();

    return reply.send(response.answer);
  } catch (error) {
    console.error("Erro na busca:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return reply.status(500).send({ error: "Erro interno", details: errorMessage });
  }
});

app.listen({ port: 4000 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Servidor rodando em ${address}`);
});
