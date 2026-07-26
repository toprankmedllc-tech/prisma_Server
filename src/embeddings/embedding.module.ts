import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { OpenRouterProvider } from '../llm/providers/openrouter.provider';


@Module({
    providers: [EmbeddingService, OpenRouterProvider],
    exports: [EmbeddingService],
})
export class EmbeddingModule { }