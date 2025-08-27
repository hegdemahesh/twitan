import { EventDoc } from "../../../shared/events";

export type HandlerArgs = {
  db: FirebaseFirestore.Firestore;
  snap: FirebaseFirestore.QueryDocumentSnapshot;
  data: EventDoc;
};

export type Handler = (args: HandlerArgs) => Promise<void>;
