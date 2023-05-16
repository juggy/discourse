# frozen_string_literal: true

class BookmarksBulkAction
  def initialize(user, bookmarks_ids, operation, options = {})
    @user = user
    @bookmarks_ids = bookmarks_ids
    @operation = operation
    @changed_ids = []
    @options = options
  end

  def self.operations
    @operations ||= %w[clear_reminder delete_reminder delete]
  end

  def self.register_operation(name, &block)
    operations << name
    define_method(name, &block)
  end

  def perform!
    unless BookmarksBulkAction.operations.include?(@operation[:type])
      raise Discourse::InvalidParameters.new(:operation)
    end
    # careful these are private methods, we need send
    send(@operation[:type])
    @changed_ids.sort
  end

  private

  def delete
    manager = BookmarkManager.new @user
    @bookmarks_ids.map { |id| manager.destroy(id) }
    @changed_ids = @bookmarks_ids
  end

  def clear_reminder
    bookmarks = @user.bookmarks.where(id: @bookmarks_ids)
    bookmarks.update_all(reminder_last_sent_at: Time.zone.now, reminder_set_at: nil)
    @changed_ids = bookmarks.select(:id)
  end

  def delete_reminder
    bookmarks = @user.bookmarks.where(id: @bookmarks_ids)
    bookmarks.update_all(reminder_at: nil, reminder_set_at: nil)
    @changed_ids = bookmarks.select(:id)
  end
end
