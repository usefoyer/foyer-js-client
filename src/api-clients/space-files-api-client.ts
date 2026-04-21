import { BlobClient, BlockBlobClient, ContainerClient, } from '@azure/storage-blob';
import { HttpClient } from "../http-client";
import { FoyerApiOKResponse, FoyerApiSearchResponse } from "../response";
import { AddFileViewModel, AddFolderViewModel, FileModelOrderById, FilesSearchRequest, FileViewModel, RawAddFileViewModel, RawFileViewModel, SasResponse } from "../view-models/file-view-models";
import { BaseApiClient } from "./base-api-client";
import { v4 as uuidv4 } from 'uuid';
import { urlJoin } from '../util';
import { ReadStream, statSync } from 'fs';

export class SpaceFilesApiClient
    extends BaseApiClient<FileViewModel, FileModelOrderById> {

    private spaceId: string;
    private sasCache: SasCache;

    constructor(httpClient: HttpClient, spaceId: string) {
        super(httpClient);
        this.spaceId = spaceId;
        this.sasCache = new SasCache(httpClient, spaceId);
    }

    private async addRawFile(vm: RawAddFileViewModel)
        : Promise<RawFileViewModel> {
        return this.httpClient.request({
            endpoint: this.getEndpoint(),
            method: 'POST',
            json: vm,
        });
    }

    private rawFileToFile(vm: RawFileViewModel): FileViewModel {
        return {
            id: vm.id,
            parent_id: vm.parent_id,
            is_folder: vm.is_folder,
            name: vm.name,
            size: vm.size,
            created_at: vm.created_at,
        }
    }

    async addFolder(vm: AddFolderViewModel): Promise<FileViewModel> {
        const rawFile = await this.addRawFile({
            parent_id: vm.parent_id,
            is_folder: true,
            name: vm.name,
        });
        return this.rawFileToFile(rawFile);
    }

    private async getRaw(id: string): Promise<RawFileViewModel> {
        return await this.httpClient.request<RawFileViewModel>({
            endpoint: urlJoin(this.getEndpoint(), id),
        });
    }

    async get(id: string): Promise<FileViewModel> {
        const rawFile = await this.getRaw(id);
        return {
            id: rawFile.id,
            parent_id: rawFile.parent_id,
            is_folder: rawFile.is_folder,
            name: rawFile.name,
            size: rawFile.size,
            created_at: rawFile.created_at,
        };
    }

    /**
     * Deletes a file or folder.
     * @param id the id of the file or folder to delete.
     * @returns 
     */
    async delete(id: string): Promise<FoyerApiOKResponse> {
        return await this.restClient.delete(id);
    }

    /**
     * Searches files and folders within this space.
     * @param search the query to run (`parent_id` is used for searching within folders, leave empty to search top level).
     * @returns 
     */
    async search(
        search: FilesSearchRequest = {})
        : Promise<FoyerApiSearchResponse<FileViewModel>> {
        return this.restClient.search(search);
    }

    async getBlobSize(blockBlobClient: BlockBlobClient): Promise<number> {
        const properties = await blockBlobClient.getProperties();
        return properties.contentLength || 0;
    }

    private makeRawFileVm(vm: AddFileViewModel, blobName: string, size: number): RawAddFileViewModel {
        return {
            parent_id: vm.parent_id,
            is_folder: false,
            name: vm.name,
            size: size,
            blob: blobName,
            silent: vm.silent,
        }
    }

    async uploadFileFromString(
        vm: AddFileViewModel, contents: string
    ): Promise<FileViewModel> {
        const blobName = uuidv4();

        const blockBlobClient = await this.getBlockBlobClient(blobName);
        await blockBlobClient.upload(contents, contents.length);

        const rawFile = await this.addRawFile(
            this.makeRawFileVm(vm, blobName, await this.getBlobSize(blockBlobClient)));
        return this.rawFileToFile(rawFile);
    }

    async uploadFileFromBuffer(
        vm: AddFileViewModel, buffer: Buffer
    ): Promise<FileViewModel> {
        const blobName = uuidv4();

        const blockBlobClient = await this.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(buffer);

        const rawFile = await this.addRawFile(
            this.makeRawFileVm(vm, blobName, await this.getBlobSize(blockBlobClient)));
        return this.rawFileToFile(rawFile);
    }

    async uploadFileFromReadStream(vm: AddFileViewModel, stream: ReadStream): Promise<FileViewModel> {
        const blobName = uuidv4();

        const blockBlobClient = await this.getBlockBlobClient(blobName);
        await blockBlobClient.uploadStream(stream);

        const rawFile = await this.addRawFile(
            this.makeRawFileVm(vm, blobName, await this.getBlobSize(blockBlobClient)));
        return this.rawFileToFile(rawFile);
    }

    async uploadFileFromLocalPath(vm: AddFileViewModel, localFilePath: string): Promise<FileViewModel> {
        const blobName = uuidv4();

        const blockBlobClient = await this.getBlockBlobClient(blobName);
        await blockBlobClient.uploadFile(localFilePath);

        const rawFile = await this.addRawFile(
            this.makeRawFileVm(vm, blobName, await this.getBlobSize(blockBlobClient)));
        return this.rawFileToFile(rawFile);
    }

    private async getBlockBlobClient(blob: string): Promise<BlockBlobClient> {
        const containerClient = await this.sasCache.getContainerClient();
        return containerClient.getBlockBlobClient(blob);
    }

    private async getBlobClient(id: string): Promise<BlobClient> {
        const containerClient = await this.sasCache.getContainerClient();
        const vm = await this.getRaw(id);
        if (vm.is_folder) {
            throw new Error('Attempted to download folder where file was expected. To download a Folder, iterate over files.');
        }
        const blobClient = containerClient.getBlobClient(vm.blob);
        return blobClient;
    }

    private async downloadFileRaw(id: string, onProgress?: Function) {
        const blobClient = await this.getBlobClient(id);
        const downloadBlobResponse = await blobClient.download(undefined, undefined, {
            onProgress: (e) => {
                if (onProgress) {
                    onProgress({ loadedBytes: e.loadedBytes });
                }
            },
        });
        return downloadBlobResponse;
    }

    /**
     * For use in browser only (returns `undefined` when run on NodeJS).
     */
    async downloadFileToBlob(id: string, onProgress?: Function): Promise<Blob | undefined> {
        const downloadBlobResponse = await this.downloadFileRaw(id, onProgress);
        return downloadBlobResponse.blobBody;
    }

    /**
     * For use in NodeJS. Downloads the file from this Space to the local filesystem.
     */
    async downloadFileToLocalFile(id: string, localFilePath: string, onProgress?: Function) {
        const blobClient = await this.getBlobClient(id);
        await blobClient.downloadToFile(localFilePath, undefined, undefined, {
            onProgress: (e) => {
                if (onProgress) {
                    onProgress({ loadedBytes: e.loadedBytes });
                }
            },
        });
    }

    /**
     * For use in NodeJS. Downloads the file to a writable stream.
     */
    async downloadFileAsStream(
        id: string,
        writableStream: NodeJS.WritableStream
    ) {
        const blobClient = await this.getBlobClient(id);
        const downloadResponse = await blobClient.download();
        if (!downloadResponse.errorCode && downloadResponse?.readableStreamBody) {
            downloadResponse.readableStreamBody.pipe(writableStream);
        }
    }

    /**
     * For use in NodeJS. Downloads the file into a string.
     */
    async downloadFileAsString(id: string): Promise<string | null> {
        const blobClient = await this.getBlobClient(id);
        const downloadResponse = await blobClient.download();
        if (!downloadResponse.errorCode && downloadResponse.readableStreamBody) {
            const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
            return downloaded.toString();
        }
        return null;
    }

    getEndpoint(): string {
        return `spaces/${this.spaceId}/files`;
    }
}

class SasCache {
    secondsToRefresh = 60;

    httpClient: HttpClient;
    spaceId: string;

    refreshedAt: number;
    sasResponse: SasResponse;

    constructor(httpClient: HttpClient, spaceId: string) {
        this.httpClient = httpClient;
        this.spaceId = spaceId;
    }

    private shouldRefresh() {
        return !this.refreshedAt || (Date.now() - this.refreshedAt) > (this.secondsToRefresh * 1000);
    }

    async refresh() {
        if (this.shouldRefresh()) {
            this.refreshedAt = Date.now();
            this.sasResponse = await this.httpClient.request<SasResponse>({
                endpoint: `spaces/${this.spaceId}/sas`,
            });
        }
    }

    async get(): Promise<SasResponse> {
        await this.refresh();
        return this.sasResponse;
    }

    async getContainerClient(): Promise<ContainerClient> {
        return new ContainerClient((await this.get()).url);
    }
}

function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        readableStream.on('data', (data) => {
            const content: Buffer = data instanceof Buffer ? data : Buffer.from(data);
            chunks.push(content);
        });
        readableStream.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on('error', reject);
    });
}
