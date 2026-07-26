import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LLMService } from './llm.service';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Module({
    imports: [ConfigModule],
    providers: [OpenRouterProvider, LLMService],
    exports: [LLMService],
})
export class LLMModule { }