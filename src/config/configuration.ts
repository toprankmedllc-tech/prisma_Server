export default () => ({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
    
    database: {
        url: process.env.DATABASE_URL,
    },
    
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'openai/text-embedding-ada-002',
    },
    
    chroma: {
        // CloudClient configuration
        apiKey: process.env.CHROMA_API_KEY,
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
        collection: process.env.CHROMA_COLLECTION || 'medical_knowledge',
        
        // Keep fallback for local development
        url: process.env.CHROMA_URL || 'http://localhost:8000',
        mode: process.env.CHROMA_MODE || 'cloud', // 'cloud' or 'local'
    },

    redis: {
        url: process.env.REDIS_URL || "rediss://default:gQAAAAAAAaVyAAIgcDIxNTU0Mzk4NDlmZGM0NjYwYWI4YTA4YWE4YWRmODRkZA@probable-dolphin-107890.upstash.io:6379",
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
    },
});