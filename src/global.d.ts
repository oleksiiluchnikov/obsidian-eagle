/// <reference types="svelte" />
/// <reference types="vite/client" />

export type EagleFolderID = string;
export type EagleItemID = string; // UUID, e.g. A0B1C2D3E4F5G6H7
export type Styles = {
    depth: number;
    first: boolean;
    last: boolean;
};

export type EagleFolderInfoData = {
    id: EagleFolderID;
    name: string;
    description: string;
    children: EagleFolderInfoData[]; // assuming children are of the same type
    modificationTime: number;
    tags: string[];
    iconColor: string;
    password: string;
    passwordTips: string;
    parent: string;
    isExpand: boolean;
    images: string[];
    size: number;
    vstype: string;
    styles: Styles;
    isVisible: boolean;
    imagesMappings: Record<string, unknown>; // assuming that we don't know the structure of the objects in the imagesMappings
    imageCount: number;
    descendantImageCount: number;
    pinyin: string;
    extendTags: string[];
    covers: string[];
    index: number;
    $$hashKey: string;
    newFolderName: string;
};

export type ItemInfoData = {
	id: string;
	name: string;
	size: number;
	ext: string;
	tags: string[];
	folders: string[];
	isDeleted: boolean;
	url: string;
	annotation: string;
	modificationTime: number;
	height: number;
	width: number;
	lastModified: number;
	palettes: {
		color: number[];
		ratio: number;
		$$hashKey: string;
	}[];
};
