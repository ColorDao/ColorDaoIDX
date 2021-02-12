import Ceramic from '@ceramicnetwork/http-client'
import { IDX } from '@ceramicstudio/idx'
import { Ed25519Provider } from 'key-did-provider-ed25519'

import { definitions } from './config.json'

const CERAMIC_URL = 'https://ceramic-clay.3boxlabs.com'
// const CERAMIC_URL = 'http://localhost:7007' //localhost

export type NoteItem = {
  id: string
  title: string
}

export type PetitionList = { petitions: Array<NoteItem> }

export type IDXInit = PetitionList & {
  ceramic: Ceramic
  idx: IDX
}

export async function getIDX(seed: Uint8Array): Promise<IDXInit> {
  // Create the Ceramic instance and inject provider
  const ceramic = new Ceramic(CERAMIC_URL)
  await ceramic.setDIDProvider(new Ed25519Provider(seed))

  // Create the IDX instance with the definitions aliases from the config
  const idx = new IDX({ ceramic, aliases: definitions })

  // Load the existing petitions
  const notesList = await idx.get<{ petitions: Array<NoteItem> }>('petitions')
  return { ceramic, idx, petitions: notesList?.petitions ?? [] }
}