import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudClient, Collection } from 'chromadb';

@Injectable()
export class ChromaClientProvider implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ChromaClientProvider.name);
    private client: CloudClient | null = null;
    private collection: Collection | null = null;
    private collectionName: string;
    private maxRetries = 3;
    private retryDelay = 1000;

    constructor(private configService: ConfigService) {
        this.collectionName = "Usmle_knowledge_bank"
    }

    async onModuleInit() {
        // this calls env directly 
        const apiKey = this.configService.get<string>('CHROMA_API_KEY');
        const tenant = this.configService.get<string>('CHROMA_TENANT');
        const database = this.configService.get<string>('CHROMA_DATABASE');

        if (!apiKey || !tenant || !database) {
            this.logger.error('Missing Chroma Cloud credentials. Check CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE');
            return;
        }

        // if using config file 

        // const chromaConfig = this.configService.get('chroma');

        // if (!chromaConfig.apiKey || !chromaConfig.tenant || !chromaConfig.database) {
        //     this.logger.error('Missing Chroma Cloud credentials');
        //     return;
        // }


        this.logger.log(`Connecting to Chroma Cloud (tenant: ${tenant}, database: ${database})`);

        try {
            await this.connectWithRetry(apiKey, tenant, database);
        } catch (error) {
            this.logger.error('Failed to connect to Chroma Cloud after retries', error);
            this.logger.warn('Chroma Cloud connection failed. Some features may be unavailable.');
        }
    }

    private async connectWithRetry(apiKey: string, tenant: string, database: string): Promise<void> {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Use CloudClient instead of ChromaClient
                this.client = new CloudClient({
                    apiKey: apiKey,
                    tenant: tenant,
                    database: database,
                });

                // Get or create collection (same as before)
                this.collection = await this.client.getOrCreateCollection({
                    name: this.collectionName,
                    metadata: { 'hnsw:space': 'cosine' },
                });

                this.logger.log(`Successfully connected to Chroma Cloud (attempt ${attempt})`);
                return;
            } catch (error: any) {
                this.logger.warn(`Chroma Cloud connection attempt ${attempt} failed: ${error.message}`);

                if (attempt < this.maxRetries) {
                    this.logger.log(`Retrying in ${this.retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                    this.retryDelay *= 2; // Exponential backoff
                } else {
                    throw error;
                }
            }
        }
    }

    async onModuleDestroy() {
        this.collection = null;
        this.client = null;
        this.logger.log('Chroma Cloud connection closed');
    }

    getCollection(): Collection {
        if (!this.collection) {
            throw new Error('Chroma collection not initialized. Please check Chroma Cloud connection.');
        }
        return this.collection;
    }

    getClient(): CloudClient {
        if (!this.client) {
            throw new Error('Chroma client not initialized. Please check Chroma Cloud connection.');
        }
        return this.client;
    }

    isInitialized(): boolean {
        return this.client !== null && this.collection !== null;
    }
}