import Mixin from "@ember/object/mixin";
import I18n from "I18n";
import { inject as service } from "@ember/service";

function identity() {}

export default Mixin.create({
  dialog: service(),

  processedCount: 0,

  perform(toProcess, operation) {
    this.set("processedCount", 0);
    if (toProcess.length > 20) {
      this.send("changeBulkTemplate", "modal/bulk-progress");
    }

    this.set("loading", true);

    return this._processChunks(toProcess, operation)
      .catch(() => {
        this.dialog.alert(I18n.t("generic_error"));
      })
      .finally(() => {
        this.set("loading", false);
      });
  },

  _generateChunks(allItems) {
    let startIndex = 0;
    const chunkSize = 30;
    const chunks = [];

    while (startIndex < allItems.length) {
      let items = allItems.slice(startIndex, startIndex + chunkSize);
      chunks.push(items);
      startIndex += chunkSize;
    }

    return chunks;
  },

  _processChunks(toProcess, operation) {
    const chunks = this._generateChunks(toProcess);
    const ids = [];

    const tasks = chunks.map((items) => () => {
      return this.bulkOperation(items, operation).then((result) => {
        this.set("processedCount", this.get("processedCount") + items.length);
        return result;
      });
    });

    return new Promise((resolve, reject) => {
      const resolveNextTask = () => {
        if (tasks.length === 0) {
          const items = ids.map((id) => toProcess.findBy("id", id));
          return resolve(items);
        }

        tasks
          .shift()()
          .then((result) => {
            const resultIds = this.idsFromResults(result);
            if (resultIds) {
              ids.push(...resultIds);
            }
            resolveNextTask();
          })
          .catch(reject);
      };

      resolveNextTask();
    });
  },

  performAndRefresh(toProcess, operation) {
    return this.perform(toProcess, operation).then(() => {
      (this.refreshClosure || identity)();
      this.send("closeModal");
    });
  },

  // bulkOperation(_items, _operation)
  bulkOperation() {
    throw "to implement";
  },

  // idsFromResults(_result)
  idsFromResults() {
    throw "to implement";
  },
});
