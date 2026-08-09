import handler from "../matches.js";

export default function allHandler(req, res) {
  req.url = "/api/matches?action=all";
  return handler(req, res);
}
