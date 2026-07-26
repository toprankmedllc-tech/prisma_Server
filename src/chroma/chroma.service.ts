import { Injectable, Logger } from '@nestjs/common';
import { ChromaClientProvider } from './chroma-client';
import { EmbeddingService } from '../embeddings/embedding.service';

export interface ChromaDocument {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
}

export interface QueryResult {
    content: string;
    metadata: Record<string, any>;
    distance: number;
}

@Injectable()
export class ChromaService {
    private readonly logger = new Logger(ChromaService.name);

    constructor(
        private chromaClient: ChromaClientProvider,
        private embeddingService: EmbeddingService,
    ) { }

    /**
     * ADD DOCUMENTS (with external embeddings)
     */
    async addDocuments(documents: ChromaDocument[]): Promise<void> {
        if (!this.chromaClient.isInitialized()) {
            this.logger.warn('Chroma DB not initialized. Skipping document addition.');
            return;
        }

        const collection = this.chromaClient.getCollection();

        if (!documents.length) {
            this.logger.warn('No documents provided to add');
            return;
        }

        const ids = documents.map((doc) => doc.id);
        const contents = documents.map((doc) => doc.content);
        const embeddings = documents
            .filter((doc) => doc.embedding)
            .map((doc) => doc.embedding!);

        try {
            if (embeddings.length === documents.length) {
                // Use provided embeddings
                await collection.add({
                    ids,
                    documents: contents,
                    embeddings,
                    metadatas: documents.map((doc) => doc.metadata || {}),
                });
            } else {
                // Generate embeddings for documents without them
                const generatedEmbeddings = await this.embeddingService.embedBatch(contents);
                await collection.add({
                    ids,
                    documents: contents,
                    embeddings: generatedEmbeddings,
                    metadatas: documents.map((doc) => doc.metadata || {}),
                });
            }
            this.logger.log(`Added ${ids.length} document(s) to Chroma`);
        } catch (error) {
            this.logger.error('Failed to add documents to Chroma', error);
            throw error;
        }
    }

    async query(
        queryText: string,
        nResults: number = 5,
        filter?: Record<string, any>,
    ): Promise<QueryResult[]> {
        if (!this.chromaClient.isInitialized()) {
            this.logger.warn('Chroma DB not initialized. Returning empty results.');
            return [];
        }

        const collection = this.chromaClient.getCollection();

        try {
            const queryEmbedding = await this.embeddingService.embed(queryText);

            const result = await collection.query({
                queryEmbeddings: [queryEmbedding],
                nResults: nResults,
                include: ['documents', 'metadatas', 'distances'] as any,
                where: filter,
            });

            const documents = result.documents[0];
            const metadatas = result.metadatas[0];
            const distances = result.distances[0];

            if (!documents || documents.length === 0) {
                return [];
            }

            return documents.map((content, index) => ({
                content: content || '',
                metadata: metadatas?.[index] || {},
                distance: distances?.[index] || 0,
            }));
        } catch (error) {
            this.logger.error('Failed to query Chroma', error);
            throw error;
        }
    }

    async deleteDocuments(ids: string[]): Promise<void> {
        if (!this.chromaClient.isInitialized()) {
            this.logger.warn('Chroma DB not initialized. Skipping deletion.');
            return;
        }

        const collection = this.chromaClient.getCollection();

        try {
            await collection.delete({ ids });
            this.logger.log(`Deleted ${ids.length} document(s)`);
        } catch (error) {
            this.logger.error('Failed to delete documents', error);
            throw error;
        }
    }

    async getDocument(id: string): Promise<QueryResult | null> {
        if (!this.chromaClient.isInitialized()) {
            this.logger.warn('Chroma DB not initialized. Returning null.');
            return null;
        }

        const collection = this.chromaClient.getCollection();

        try {
            const result = await collection.get({
                ids: [id],
                include: ['documents', 'metadatas'] as any,
            });

            if (!result.documents?.length) {
                return null;
            }

            return {
                content: result.documents[0] || '',
                metadata: result.metadatas?.[0] || {},
                distance: 0,
            };
        } catch (error) {
            this.logger.error('Failed to get document', error);
            throw error;
        }
    }

    async getCollectionInfo(): Promise<{ name: string; count: number }> {
        if (!this.chromaClient.isInitialized()) {
            this.logger.warn('Chroma DB not initialized. Returning empty info.');
            return { name: this.chromaClient['collectionName'] || 'unknown', count: 0 };
        }

        const collection = this.chromaClient.getCollection();

        try {
            const count = await collection.count();
            return {
                name: collection.name,
                count,
            };
        } catch (error) {
            this.logger.error('Failed to get collection info', error);
            throw error;
        }
    }
}
