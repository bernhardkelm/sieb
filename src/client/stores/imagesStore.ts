import { defineStore } from 'pinia'

import { fetchImages } from '@/api/imagesApi'
import { useRemoteList } from '@/composables/useRemoteList'

/**
 * Holds the open findings aggregated per image, own images first. Refetches whenever the data
 * version moves.
 */
export const useImagesStore = defineStore('images', () => useRemoteList(() => fetchImages()))
