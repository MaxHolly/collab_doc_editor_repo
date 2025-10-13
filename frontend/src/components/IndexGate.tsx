import { Navigate } from "react-router-dom";
import { isAuthed } from "../lib/auth";

export default function IndexGate() {
  // If logged in, land on /docs. Otherwise, go to /login.
  return isAuthed() ? <Navigate to="/docs" replace /> : <Navigate to="/login" replace />;
}
