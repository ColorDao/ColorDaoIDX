import type { Doctype } from '@ceramicnetwork/common'
import type Ceramic from '@ceramicnetwork/http-client'
import type { IDX } from '@ceramicstudio/idx'
import { useCallback, useReducer } from 'react'

import { schemas } from './config.json'
import { getIDX } from './idx'
import type { IDXInit, PetitionList } from './idx'

type AuthStatus = 'pending' | 'loading' | 'failed'
export type DraftStatus = 'unsaved' | 'saving' | 'failed' | 'saved'
type NoteLoadingStatus = 'init' | 'loading' | 'loading failed'
type NoteSavingStatus = 'loaded' | 'saving' | 'saving failed' | 'saved'

type UnauthenticatedState = { status: AuthStatus }
type AuthenticatedState = { status: 'done'; ceramic: Ceramic; idx: IDX }
export type AuthState = UnauthenticatedState | AuthenticatedState

type NavDefaultState = { type: 'default' }
type NavDraftState = { type: 'draft' }
type NavNoteState = { type: 'petition'; docID: string }

export type IndexLoadedNote = { status: NoteLoadingStatus; title: string }
export type StoredNote = {
  status: NoteSavingStatus
  title: string
  doc: Doctype
}

type Store = {
  draftStatus: DraftStatus
  petitions: Record<string, IndexLoadedNote | StoredNote>
}
type DefaultState = {
  auth: AuthState
  nav: NavDefaultState
}
type NoteState = {
  auth: AuthenticatedState
  nav: NavDraftState | NavNoteState
}
export type State = Store & (DefaultState | NoteState)

type AuthAction = { type: 'auth'; status: AuthStatus }
type AuthSuccessAction = { type: 'auth success' } & IDXInit
type NavResetAction = { type: 'nav reset' }
type NavDraftAction = { type: 'nav draft' }
type NavNoteAction = { type: 'nav petition'; docID: string }
type DraftDeleteAction = { type: 'draft delete' }
type DraftStatusAction = { type: 'draft status'; status: 'saving' | 'failed' }
type DraftSavedAction = {
  type: 'draft saved'
  title: string
  docID: string
  doc: Doctype
}
type NoteLoadedAction = { type: 'petition loaded'; docID: string; doc: Doctype }
type NoteLoadingStatusAction = {
  type: 'petition loading status'
  docID: string
  status: NoteLoadingStatus
}
type NoteSavingStatusAction = {
  type: 'petition saving status'
  docID: string
  status: NoteSavingStatus
}
type Action =
  | AuthAction
  | AuthSuccessAction
  | NavResetAction
  | NavDraftAction
  | NavNoteAction
  | DraftDeleteAction
  | DraftStatusAction
  | DraftSavedAction
  | NoteLoadedAction
  | NoteLoadingStatusAction
  | NoteSavingStatusAction

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'auth':
      return {
        ...state,
        nav: { type: 'default' },
        auth: { status: action.status },
      }
    case 'auth success': {
      const auth = {
        status: 'done',
        ceramic: action.ceramic,
        idx: action.idx,
      } as AuthenticatedState
      return action.petitions.length
        ? {
            ...state,
            auth,
            petitions: action.petitions.reduce((acc, item) => {
              acc[item.id] = { status: 'init', title: item.title }
              return acc
            }, {} as Record<string, IndexLoadedNote>),
          }
        : {
            auth,
            draftStatus: 'unsaved',
            nav: { type: 'draft' },
            petitions: {},
          }
    }
    case 'nav reset':
      return { ...state, nav: { type: 'default' } }
    case 'nav draft':
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        nav: { type: 'draft' },
      }
    case 'draft status':
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        draftStatus: action.status,
      }
    case 'draft delete':
      return {
        ...state,
        draftStatus: 'unsaved',
        nav: { type: 'default' },
      }
    case 'draft saved': {
      return {
        auth: state.auth as AuthenticatedState,
        draftStatus: 'unsaved',
        nav: { type: 'petition', docID: action.docID },
        petitions: {
          ...state.petitions,
          [action.docID]: {
            status: 'saved',
            title: action.title,
            doc: action.doc,
          },
        },
      }
    }
    case 'nav petition':
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        nav: {
          type: 'petition',
          docID: action.docID,
        },
      }
    case 'petition loaded': {
      const id = (state.nav as NavNoteState).docID
      const noteState = state.petitions[id]
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        petitions: {
          ...state.petitions,
          [id]: {
            status: 'loaded',
            title: noteState.title,
            doc: action.doc,
          },
        },
      }
    }
    case 'petition loading status': {
      const id = (state.nav as NavNoteState).docID
      const noteState = state.petitions[id] as IndexLoadedNote
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        petitions: {
          ...state.petitions,
          [id]: { ...noteState, status: action.status },
        },
      }
    }
    case 'petition saving status': {
      const id = (state.nav as NavNoteState).docID
      const noteState = state.petitions[id] as StoredNote
      return {
        ...state,
        auth: state.auth as AuthenticatedState,
        petitions: {
          ...state.petitions,
          [id]: { ...noteState, status: action.status },
        },
      }
    }
  }
}

export function useApp() {
  const [state, dispatch] = useReducer(reducer, {
    auth: { status: 'pending' },
    draftStatus: 'unsaved',
    nav: { type: 'default' },
    petitions: {},
  })

  const authenticate = useCallback((seed: Uint8Array) => {
    dispatch({ type: 'auth', status: 'loading' })
    getIDX(seed).then(
      (init) => {
        dispatch({ type: 'auth success', ...init })
      },
      (err) => {
        console.warn('authenticate call failed', err)
        dispatch({ type: 'auth', status: 'failed' })
      },
    )
  }, [])

  const openDraft = useCallback(() => {
    dispatch({ type: 'nav draft' })
  }, [])

  const deleteDraft = useCallback(() => {
    dispatch({ type: 'draft delete' })
  }, [])

  const saveDraft = useCallback(
    (title: string, text: string) => {
      dispatch({ type: 'draft status', status: 'saving' })
      const { ceramic, idx } = state.auth as AuthenticatedState
      Promise.all([
        ceramic.createDocument('tile', {
          content: { date: new Date().toISOString(), text },
          metadata: { controllers: [idx.id], schema: schemas.Petition },
        }),
        idx.get<PetitionList>('petitions'),
      ])
        .then(([doc, notesList]) => {
          const petitions = notesList?.petitions ?? []
          return idx
            .set('petitions', {
              petitions: [{ id: doc.id.toUrl(), title }, ...petitions],
            })
            .then(() => {
              const docID = doc.id.toString()
              dispatch({ type: 'draft saved', docID, title, doc })
            })
        })
        .catch((err) => {
          console.log('failed to save draft', err)
          dispatch({ type: 'draft status', status: 'failed' })
        })
    },
    [state.auth],
  )

  const openNote = useCallback(
    (docID: string) => {
      dispatch({ type: 'nav petition', docID })

      if (state.petitions[docID] == null || state.petitions[docID].status === 'init') {
        const { ceramic } = state.auth as AuthenticatedState
        ceramic.loadDocument(docID).then(
          (doc) => {
            dispatch({ type: 'petition loaded', docID, doc })
          },
          () => {
            dispatch({
              type: 'petition loading status',
              docID,
              status: 'loading failed',
            })
          },
        )
      }
    },
    [state.auth, state.petitions],
  )

  const saveNote = useCallback((doc: Doctype, text: string) => {
    const docID = doc.id.toString()
    dispatch({ type: 'petition saving status', docID, status: 'saving' })
    doc.change({ content: { date: new Date().toISOString(), text } }).then(
      () => {
        dispatch({ type: 'petition saving status', docID, status: 'saved' })
      },
      () => {
        dispatch({ type: 'petition saving status', docID, status: 'saving failed' })
      },
    )
  }, [])

  return {
    authenticate,
    deleteDraft,
    openDraft,
    openNote,
    saveDraft,
    saveNote,
    state,
  }
}