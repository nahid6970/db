import handler from "../matches.js";

export default function viewHandler(req, res) {
  req.url = "/api/matches?action=view";
  return handler(req, res);
}
