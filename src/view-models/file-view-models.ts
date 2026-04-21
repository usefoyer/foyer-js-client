import { FoyerApiClientSearchRequest } from "../http-client";

export type FileModelOrderById = 'name' | 'created_at';

export type FilesSearchRequest = { parent_id?: string } & FoyerApiClientSearchRequest<FileModelOrderById>;

export class FileViewModel {
    id: string;
    /** if this file is in a folder, this is the folder's ID, otherwise null. */
    parent_id: string;
    /** if this file is in a folder, this is the folder's ID, otherwise null. */
    is_folder: boolean;
    /** The name of the file. */
    name: string;
    /** The size of the file in bytes. */
    size: number;
    /** When this file was added. */
    created_at: Date;
};

export class AddFileViewModel {
    /** if this file is in a folder, this is the folder's ID, otherwise null. */
    parent_id?: string;
    /** The name of the file. */
    name: string;
    /** When true, the file is uploaded silently: no email notifications, no socket events, and the file is automatically marked as read for all users in the space. */
    silent?: boolean;
};

export class AddFolderViewModel {
    /** if this folder is in a folder, this is the folder's ID, otherwise null. */
    parent_id?: string;
    /** The name of the folder. */
    name: string;
};

export class RawFileViewModel {
    id: string;
    /** if this file is in a folder, this is the folder's ID, otherwise null. */
    parent_id: string;
    /** Whether not this is a folder. */
    is_folder: boolean;
    /** The name of the file or folder. */
    name: string;
    /** The size of the file in bytes (leave empty for folders). */
    size: number;
    /** The name of the blob (within the relevant space's container). */
    blob: string;
    /** The name of the thumbnail's blob (within the relevant space's container). */
    thumbnail_blob?: string;
    /** When this file or folder was added. */
    created_at: Date;
};

/**
 * View model for directly adding a file via the API (without blob storage).
 */
export class RawAddFileViewModel {
    /** if this file is in a folder, this is the folder's ID, otherwise null. */
    parent_id?: string;
    /** Whether not this is a folder. */
    is_folder: boolean;
    /** The name of the file or folder. */
    name: string;
    /** The size of the file in bytes (leave empty for folders). */
    size?: number;
    /** The name of the blob (within the relevant space's container). */
    blob?: string;
    /** The name of the thumbnail's blob (within the relevant space's container). */
    thumbnail_blob?: string;
    /** When true, the file is uploaded silently: no email notifications, no socket events, and the file is automatically marked as read for all users in the space. */
    silent?: boolean;
};

export class SasResponse {
    url: string;
    token: string;
};