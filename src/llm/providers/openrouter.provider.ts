// providers/openrouter.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    /** Override the default chat model (e.g. use a more capable reviewer model). */
    model?: string;
}

export interface ChatResponse {
    content: string;
    tokenUsage?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

export interface EmbeddingResponse {
    embedding: number[];
    index: number;
}

@Injectable()
export class OpenRouterProvider {
    private readonly logger = new Logger(OpenRouterProvider.name);
    private readonly chatClient: AxiosInstance;
    private readonly embeddingClient: AxiosInstance;
    private readonly chatModel: string;
    private readonly embeddingModel: string;
    private readonly apiKey?: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;

        if (!this.apiKey) {
            this.logger.error('OPENROUTER_API_KEY is not set in environment variables');
            throw new Error('OPENROUTER_API_KEY is required');
        }

        // Set models with fallbacks
        this.chatModel = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';
        this.embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';

        this.logger.log(`Chat model: ${this.chatModel}`);
        this.logger.log(`Embedding model: ${this.embeddingModel}`);

        // Client for chat completions
        this.chatClient = axios.create({
            baseURL: 'https://openrouter.ai/api/v1',
            timeout: 180000, // 3 minutes — LLM generation can take 60-120s
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'TopRankMedLLC',
            },
        });

        // Client for embeddings
        this.embeddingClient = axios.create({
            baseURL: 'https://openrouter.ai/api/v1',
            timeout: 180000, // 3 minutes
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'TopRankMedLLC',
            },
        });
    }

    async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
        try {
            const model = options?.model || this.chatModel;
            const requestBody: any = {
                model,
                messages: messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 4096,
            };

            // Add response_format for JSON mode if requested
            if (options?.jsonMode) {
                requestBody.response_format = { type: 'json_object' };
            }

            this.logger.debug(`Sending chat request to OpenRouter with model: ${model}`);
            this.logger.debug(`Messages count: ${messages.length}`);
            this.logger.debug(`JSON mode: ${options?.jsonMode || false}`);

            const response = await this.chatClient.post('/chat/completions', requestBody);

            if (!response.data?.choices?.[0]?.message?.content) {
                this.logger.error('Invalid response structure from OpenRouter:', response.data);
                throw new Error('Invalid response structure from OpenRouter API');
            }

            const content = response.data.choices[0].message.content;
            const usage = response.data.usage;

            return {
                content,
                tokenUsage: usage ? {
                    prompt: usage.prompt_tokens || 0,
                    completion: usage.completion_tokens || 0,
                    total: usage.total_tokens || 0,
                } : undefined,
            };
        } catch (error: any) {
            this.handleChatError(error);
            throw error;
        }
    }

    async embed(text: string): Promise<number[]> {
        const result = await this.embedBatch([text]);
        return result[0];
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        try {
            this.logger.debug(`Generating embeddings for ${texts.length} text(s)`);

            const response = await this.embeddingClient.post('/embeddings', {
                model: this.embeddingModel,
                input: texts,
            });

            if (!response.data?.data || !Array.isArray(response.data.data)) {
                this.logger.error('Invalid embedding response structure:', response.data);
                throw new Error('Invalid embedding response structure from OpenRouter API');
            }

            // Sort by index to maintain order
            const embeddings = response.data.data
                .sort((a: any, b: any) => a.index - b.index)
                .map((item: any) => item.embedding);

            this.logger.debug(`Successfully generated ${embeddings.length} embeddings`);
            return embeddings;
        } catch (error: any) {
            this.handleEmbeddingError(error);
            throw error;
        }
    }

    private handleChatError(error: any): void {
        if (axios.isAxiosError(error)) {
            this.logger.error(`OpenRouter Chat API Error: ${error.message}`);
            this.logger.error(`Status: ${error.response?.status}`);
            this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);

            if (error.response?.status === 401) {
                throw new Error('Invalid OpenRouter API key. Please check your credentials.');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else if (error.response?.status === 500) {
                throw new Error('OpenRouter service error. Please try again later.');
            }

            throw new Error(`OpenRouter API error: ${error.response?.data?.error?.message || error.message}`);
        }

        this.logger.error(`Unexpected chat error: ${error.message}`);
        throw new Error(`Failed to communicate with OpenRouter: ${error.message}`);
    }

    private handleEmbeddingError(error: any): void {
        if (axios.isAxiosError(error)) {
            this.logger.error(`OpenRouter Embedding API Error: ${error.message}`);
            this.logger.error(`Status: ${error.response?.status}`);
            this.logger.error(`Response data: ${JSON.stringify(error.response?.data)}`);

            if (error.response?.status === 401) {
                throw new Error('Invalid OpenRouter API key. Please check your credentials.');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            } else if (error.response?.status === 500) {
                throw new Error('OpenRouter service error. Please try again later.');
            }

            throw new Error(`OpenRouter embedding error: ${error.response?.data?.error?.message || error.message}`);
        }

        this.logger.error(`Unexpected embedding error: ${error.message}`);
        throw new Error(`Failed to generate embeddings: ${error.message}`);
    }

    // Health check method
    async healthCheck(): Promise<boolean> {
        try {
            // Simple test embedding to check connectivity
            await this.embed('test');
            return true;
        } catch (error) {
            this.logger.warn('Health check failed');
            return false;
        }
    }
}