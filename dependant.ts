
import { chunk } from "stunk";

export interface Principal {
  nin: string;
  email: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  photo?: string;
}

export interface Dependent {
  nin?: string;
  email?: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  photo?: string;
}

export interface Entry {
  principal: Principal;
  dependents: Dependent[];
}

export interface DependentsState {
  entries: Entry[];
}

export const dependentsChunk = chunk<DependentsState>({
  entries: [],
});

export const addEntry = (entry: Entry) => {
  dependentsChunk.set((state) => ({
    entries: [...state.entries, entry],
  }));
};

export const updateEntry = (index: number, entry: Entry) => {
  dependentsChunk.set((state) => ({
    entries: state.entries.map((e, i) => (i === index ? entry : e)),
  }));
};

export const removeEntry = (index: number) => {
  dependentsChunk.set((state) => ({
    entries: state.entries.filter((_, i) => i !== index),
  }));
};
