import { RedisVectorStore } from "@langchain/redis"
import { OpenAIEmbeddings } from "@langchain/openai"
import { createClient } from "redis";
import { config } from "dotenv";

config();

export const redis = createClient({
  url: "redis://localhost:6379"
});

export const redisVectorStore = new RedisVectorStore(
  new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
  {
    indexName: "obsidian-embeddings",
    redisClient: redis,
    keyPrefix: "obsidian:",
  }
);
