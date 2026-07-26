// embedding.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterProvider } from '../llm/providers/openrouter.provider';


@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);

    constructor(private openRouterProvider: OpenRouterProvider) { }

    async embed(text: string): Promise<number[]> {
        try {
            return await this.openRouterProvider.embed(text);
        } catch (error: any) {
            this.logger.error(`Failed to generate embedding: ${error.message}`);
            throw new Error(`Embedding generation failed: ${error.message}`);
        }
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        if (!texts.length) {
            return [];
        }

        try {
            return await this.openRouterProvider.embedBatch(texts);
        } catch (error: any) {
            this.logger.error(`Failed to generate batch embeddings: ${error.message}`);
            throw new Error(`Batch embedding generation failed: ${error.message}`);
        }
    }
}