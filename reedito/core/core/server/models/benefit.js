const reeditoBookshelf = require('./base');

const Benefit = reeditoBookshelf.Model.extend(
  {
    tableName: 'benefits',

    async onSaving(model, attr, options) {
      reeditoBookshelf.Model.prototype.onSaving.call(this, model, attr, options);
      // Make sure name is trimmed of extra spaces
      const name = this.get('name') && this.get('name').trim();
      this.set('name', name);
      if (this.hasChanged('slug') || (!this.get('slug') && this.get('name'))) {
        // Pass the new slug through the generator to strip illegal characters, detect duplicates
        const slug = await reeditoBookshelf.Model.generateSlug(
          Benefit,
          this.get('slug') || this.get('name'),
          { transacting: options.transacting },
        );
        this.set({ slug });
      }
    },
  },
  {
    orderDefaultOptions() {
      return {
        name: 'ASC',
        created_at: 'DESC',
      };
    },
  },
);

const Benefits = reeditoBookshelf.Collection.extend({
  model: Benefit,
});

module.exports = {
  Benefit: reeditoBookshelf.model('Benefit', Benefit),
  Benefits: reeditoBookshelf.collection('Benefits', Benefits),
};
