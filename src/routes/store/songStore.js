import { writable } from 'svelte/store'
import songs from '../db/songs'

const songStore = writable(songs)

export default songStore