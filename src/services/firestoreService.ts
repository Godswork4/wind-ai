import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Data Models
export interface Course {
  id: string;
  title: string;
  description: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface ReadingDocument {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  courseId?: string;
  ownerId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Highlight {
  id: string;
  documentId: string;
  userId: string;
  text: string;
  range: { start: number; end: number };
  color: string;
  createdAt: any;
}

export interface Note {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  createdAt: any;
  updatedAt: any;
}

// Services
export const documentService = {
  create: async (title: string, content: string, sourceUrl?: string, courseId?: string) => {
    const path = 'documents';
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const docRef = await addDoc(collection(db, path), {
        title,
        content,
        sourceUrl: sourceUrl || '',
        courseId: courseId || '',
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  update: async (id: string, updates: Partial<ReadingDocument>) => {
    const path = `documents/${id}`;
    try {
      const docRef = doc(db, 'documents', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  delete: async (id: string) => {
    const path = `documents/${id}`;
    try {
      await deleteDoc(doc(db, 'documents', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  subscribe: (userId: string, callback: (docs: ReadingDocument[]) => void) => {
    const q = query(collection(db, 'documents'), where('ownerId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReadingDocument));
      callback(docs);
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'documents'));
  },

  getById: async (id: string) => {
    const path = `documents/${id}`;
    try {
      const d = await getDoc(doc(db, 'documents', id));
      if (d.exists()) return { id: d.id, ...d.data() } as ReadingDocument;
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  }
};

export const courseService = {
  create: async (title: string, description: string) => {
    const path = 'courses';
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      const docRef = await addDoc(collection(db, path), {
        title,
        description,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  subscribe: (userId: string, callback: (courses: Course[]) => void) => {
    const path = 'courses';
    const q = query(collection(db, path), where('ownerId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      callback(courses);
    }, (e) => handleFirestoreError(e, OperationType.LIST, path));
  },

  update: async (id: string, updates: Partial<Course>) => {
    const path = `courses/${id}`;
    try {
      const docRef = doc(db, 'courses', id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  delete: async (id: string) => {
    const path = `courses/${id}`;
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};

export const highlightService = {
  create: async (docId: string, highlight: Omit<Highlight, 'id' | 'userId' | 'createdAt'>) => {
    const path = `documents/${docId}/highlights`;
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      await addDoc(collection(db, path), {
        ...highlight,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  subscribe: (docId: string, callback: (highlights: Highlight[]) => void) => {
    const path = `documents/${docId}/highlights`;
    const q = collection(db, path);
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Highlight));
      callback(items);
    }, (e) => handleFirestoreError(e, OperationType.LIST, path));
  },

  delete: async (docId: string, id: string) => {
    const path = `documents/${docId}/highlights/${id}`;
    try {
      await deleteDoc(doc(db, 'documents', docId, 'highlights', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};

export const noteService = {
  createOrUpdate: async (docId: string, content: string, noteId?: string) => {
    const path = `documents/${docId}/notes`;
    try {
      if (!auth.currentUser) throw new Error("Not authenticated");
      if (noteId) {
        await updateDoc(doc(db, path, noteId), {
          content,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, path), {
          documentId: docId,
          content,
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  subscribe: (docId: string, callback: (notes: Note[]) => void) => {
    const path = `documents/${docId}/notes`;
    const q = collection(db, path);
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Note));
      callback(items);
    }, (e) => handleFirestoreError(e, OperationType.LIST, path));
  }
};
