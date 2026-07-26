import { Module } from '@nestjs/common';
import { ChromaClientProvider } from './chroma-client';
import { ChromaService } from './chroma.service';
import { EmbeddingModule } from '../embeddings/embedding.module';

@Module({
    imports: [EmbeddingModule],
    providers: [ChromaClientProvider, ChromaService],
    exports: [ChromaService, ChromaClientProvider],
})
export class ChromaModule { }