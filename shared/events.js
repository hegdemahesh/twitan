"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventNames = exports.EventTypes = void 0;
exports.isTournamentCreate = isTournamentCreate;
exports.EventTypes = {
    Tournament: 'tournament',
};
exports.EventNames = {
    Tournament: {
        CreateBadmintonTournament: 'createBadmintonTournament',
    },
};
function isTournamentCreate(e) {
    return (e.eventType === exports.EventTypes.Tournament &&
        e.eventName === exports.EventNames.Tournament.CreateBadmintonTournament);
}
//# sourceMappingURL=events.js.map