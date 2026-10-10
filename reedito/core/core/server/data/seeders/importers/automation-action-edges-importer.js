"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationActionEdgesImporter = void 0;
const table_importer_1 = require("./table-importer");
class AutomationActionEdgesImporter extends table_importer_1.TableImporter {
    static table = 'automation_action_edges';
    static dependencies = ['automation_actions'];
    constructor(knex, transaction) {
        super(AutomationActionEdgesImporter.table, knex, transaction);
    }
    async import() {
        const actions = await this.transaction
            .select('id', 'automation_id', 'created_at')
            .from('automation_actions')
            .orderBy('automation_id')
            .orderBy('created_at')
            .orderBy('id');
        const actionsByAutomation = new Map();
        for (const action of actions) {
            const automationActions = actionsByAutomation.get(action.automation_id) ?? [];
            automationActions.push(action);
            actionsByAutomation.set(action.automation_id, automationActions);
        }
        const edges = [];
        for (const automationActions of actionsByAutomation.values()) {
            for (let index = 1; index < automationActions.length; index += 1) {
                edges.push({
                    source_action_id: automationActions[index - 1].id,
                    target_action_id: automationActions[index].id,
                });
            }
        }
        if (edges.length > 0) {
            await this.batchInsert(edges);
        }
    }
}
exports.AutomationActionEdgesImporter = AutomationActionEdgesImporter;
