import { useEffect, useState } from "react";

import { modelPersisted, storedModel, subscribeStoredModel, type StoredModel } from "@/lib/stt-model";

/** What the phone holds of the Whistle model. `undefined` while the first look is still under way. */
export interface StoredModelView {
  model: StoredModel | null | undefined;
  /** Whether the browser promised to keep the copy when space runs low. */
  persisted: boolean;
}

/**
 * The phone's copy of the Whistle model, read from Cache Storage and kept current: it looks again
 * whenever lib/stt-model.ts adds, replaces, removes or deletes a damaged copy. A read that fails
 * (no Cache Storage here) is "no copy", the same answer as an empty cache.
 */
export function useStoredModel(): StoredModelView {
  const [view, setView] = useState<StoredModelView>({ model: undefined, persisted: false });
  useEffect(() => {
    let live = true;
    const look = () => {
      void (async () => {
        const model = await storedModel().catch(() => null);
        const persisted = model === null ? false : await modelPersisted();
        if (live) setView({ model, persisted });
      })();
    };
    look();
    const unsubscribe = subscribeStoredModel(look);
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return view;
}
