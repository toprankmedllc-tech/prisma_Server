import { Module } from '@nestjs/common';
import { QuestionsModule } from '../questions/questions.module';
import { ReviewController } from './review.controller';

@Module({
    imports: [QuestionsModule],
    controllers: [ReviewController],
})
export class ReviewModule {}