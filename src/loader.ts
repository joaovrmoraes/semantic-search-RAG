import path from "node:path";

import { DirectoryLoader } from "langchain/document_loaders/fs/directory"
import { TextLoader } from "langchain/document_loaders/fs/text"
import { TokenTextSplitter } from "langchain/text_splitter"
import { RedisVectorStore } from "@langchain/redis"
import { OpenAIEmbeddings } from "@langchain/openai"
import { createClient } from "redis";
import { config } from "dotenv";

config();

const loader = new DirectoryLoader(
  path.resolve(__dirname, '../all-txt'),
  {
    '.txt': path => new TextLoader(path)
  }
);

export async function load() {
  const docs = await loader.load();

  const splitter = new TokenTextSplitter({
    encodingName: "cl100k_base",
    chunkSize: 500,
    chunkOverlap: 0,
  });

  const splittedDocuments = await splitter.splitDocuments(docs);

  const redis = createClient({
    url: "redis://localhost:6379"
  });

  await redis.connect();

  await RedisVectorStore.fromDocuments(splittedDocuments, new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }), {
    indexName: "obsidian-embeddings",
    redisClient: redis,
    keyPrefix: "obsidian:",
  });

  await redis.disconnect();
}