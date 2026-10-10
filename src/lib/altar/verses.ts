/**
 * Curated Family Altar verse references (King James Version). The week's
 * seven days are picked from this list deterministically by date (see
 * versesForWeek in ./week.ts), so no usage history needs storing; the text is
 * fetched from bible-api.com at generation time. Admins can swap any day.
 *
 * Every reference here was checked against bible-api.com (KJV) when added.
 * Keep entries to a single verse or a short range so a family can read it
 * aloud.
 */
export const FAMILY_ALTAR_VERSES: readonly string[] = [
  // Psalms
  "Psalm 1:1-2", "Psalm 1:3", "Psalm 4:8", "Psalm 5:3", "Psalm 8:3-4", "Psalm 16:8", "Psalm 16:11",
  "Psalm 18:2", "Psalm 19:1", "Psalm 19:14", "Psalm 23:1", "Psalm 23:4", "Psalm 24:1", "Psalm 25:4-5",
  "Psalm 27:1", "Psalm 27:4", "Psalm 27:14", "Psalm 30:5", "Psalm 31:24", "Psalm 32:8", "Psalm 33:12",
  "Psalm 34:1", "Psalm 34:8", "Psalm 34:18", "Psalm 37:4", "Psalm 37:5", "Psalm 37:23", "Psalm 40:1-2",
  "Psalm 42:1", "Psalm 46:1", "Psalm 46:10", "Psalm 51:10", "Psalm 55:22", "Psalm 56:3", "Psalm 62:1",
  "Psalm 63:1", "Psalm 66:18", "Psalm 84:11", "Psalm 90:12", "Psalm 91:1", "Psalm 91:11", "Psalm 95:6",
  "Psalm 100:4", "Psalm 103:2", "Psalm 103:12", "Psalm 107:1", "Psalm 112:7", "Psalm 116:1", "Psalm 118:24",
  "Psalm 119:11", "Psalm 119:105", "Psalm 121:1-2", "Psalm 126:5", "Psalm 127:1", "Psalm 127:3",
  "Psalm 133:1", "Psalm 136:1", "Psalm 138:8", "Psalm 139:14", "Psalm 145:18", "Psalm 147:3", "Psalm 150:6",
  // Proverbs
  "Proverbs 1:7", "Proverbs 3:5-6", "Proverbs 3:9", "Proverbs 4:23", "Proverbs 10:12", "Proverbs 11:25",
  "Proverbs 12:25", "Proverbs 14:26", "Proverbs 15:1", "Proverbs 16:3", "Proverbs 16:9", "Proverbs 17:17",
  "Proverbs 18:10", "Proverbs 18:24", "Proverbs 22:6", "Proverbs 27:17", "Proverbs 28:13", "Proverbs 29:18",
  "Proverbs 31:10", "Proverbs 31:30",
  // Old Testament
  "Genesis 1:1", "Genesis 1:27", "Genesis 12:2", "Genesis 15:6", "Genesis 18:14", "Genesis 28:15", "Genesis 50:20",
  "Exodus 14:14", "Exodus 15:2", "Exodus 20:12", "Exodus 33:14", "Numbers 6:24-26", "Numbers 23:19",
  "Deuteronomy 6:5", "Deuteronomy 6:6-7", "Deuteronomy 31:6", "Deuteronomy 31:8", "Deuteronomy 33:27",
  "Joshua 1:8", "Joshua 1:9", "Joshua 24:15", "Ruth 1:16", "1 Samuel 3:10", "1 Samuel 15:22", "1 Samuel 16:7",
  "2 Samuel 22:31", "1 Kings 18:21", "2 Kings 6:16", "1 Chronicles 16:11", "1 Chronicles 29:11",
  "2 Chronicles 7:14", "2 Chronicles 16:9", "Nehemiah 8:10", "Job 1:21", "Job 19:25", "Job 23:10", "Job 42:2",
  "Ecclesiastes 3:1", "Ecclesiastes 12:13", "Isaiah 9:6", "Isaiah 12:2", "Isaiah 26:3", "Isaiah 30:15",
  "Isaiah 30:21", "Isaiah 40:8", "Isaiah 40:29", "Isaiah 40:31", "Isaiah 41:10", "Isaiah 43:2", "Isaiah 43:19",
  "Isaiah 53:5", "Isaiah 54:17", "Isaiah 55:8-9", "Isaiah 55:11", "Isaiah 58:11", "Isaiah 59:1", "Isaiah 60:1",
  "Isaiah 61:1", "Isaiah 64:8", "Jeremiah 17:7", "Jeremiah 29:11", "Jeremiah 31:3", "Jeremiah 32:17",
  "Jeremiah 33:3", "Lamentations 3:22-23", "Ezekiel 36:26", "Daniel 3:17", "Daniel 11:32", "Hosea 6:3",
  "Joel 2:25", "Joel 2:28", "Micah 6:8", "Micah 7:7", "Habakkuk 2:3", "Habakkuk 3:17-18", "Zephaniah 3:17",
  "Zechariah 4:6", "Malachi 3:6", "Malachi 3:10", "Malachi 4:2", "Malachi 4:5-6",
  // Gospels
  "Matthew 4:4", "Matthew 5:6", "Matthew 5:8", "Matthew 5:14", "Matthew 5:16", "Matthew 6:6", "Matthew 6:21",
  "Matthew 6:33", "Matthew 6:34", "Matthew 7:7", "Matthew 7:24", "Matthew 9:37-38", "Matthew 11:28",
  "Matthew 11:29-30", "Matthew 16:18", "Matthew 17:20", "Matthew 18:20", "Matthew 19:26", "Matthew 22:37",
  "Matthew 24:35", "Matthew 25:21", "Matthew 28:19-20", "Mark 1:35", "Mark 4:39", "Mark 5:36", "Mark 9:23",
  "Mark 10:14", "Mark 10:27", "Mark 10:45", "Mark 11:22", "Mark 11:24", "Mark 16:15", "Mark 16:17-18",
  "Luke 1:37", "Luke 1:45", "Luke 2:10-11", "Luke 2:52", "Luke 4:18", "Luke 6:31", "Luke 6:38", "Luke 9:23",
  "Luke 10:41-42", "Luke 11:9", "Luke 12:32", "Luke 15:7", "Luke 18:1", "Luke 18:27", "Luke 19:10",
  "Luke 21:33", "Luke 24:32", "John 1:1", "John 1:12", "John 1:14", "John 3:3", "John 3:16", "John 3:30",
  "John 4:24", "John 5:24", "John 6:35", "John 6:37", "John 6:63", "John 8:12", "John 8:32", "John 8:36",
  "John 10:10", "John 10:11", "John 10:27-28", "John 11:25", "John 11:35", "John 13:34-35", "John 14:1-2",
  "John 14:6", "John 14:12", "John 14:21", "John 14:27", "John 15:5", "John 15:7", "John 15:13", "John 16:13",
  "John 16:33", "John 17:17", "John 20:29",
  // Acts and the Epistles
  "Acts 1:8", "Acts 2:38", "Acts 2:42", "Acts 3:19", "Acts 4:12", "Acts 4:31", "Acts 16:31", "Acts 17:28",
  "Acts 20:35", "Romans 1:16", "Romans 3:23", "Romans 5:1", "Romans 5:8", "Romans 6:23", "Romans 8:1",
  "Romans 8:14", "Romans 8:18", "Romans 8:28", "Romans 8:31", "Romans 8:37", "Romans 8:38-39", "Romans 10:9",
  "Romans 10:17", "Romans 12:1", "Romans 12:2", "Romans 12:12", "Romans 12:21", "Romans 15:13",
  "1 Corinthians 2:9", "1 Corinthians 10:13", "1 Corinthians 13:4-5", "1 Corinthians 13:13",
  "1 Corinthians 15:57", "1 Corinthians 15:58", "1 Corinthians 16:13", "2 Corinthians 4:16",
  "2 Corinthians 4:17-18", "2 Corinthians 5:7", "2 Corinthians 5:17", "2 Corinthians 9:7", "2 Corinthians 12:9",
  "Galatians 2:20", "Galatians 5:22-23", "Galatians 6:2", "Galatians 6:9", "Ephesians 2:8-9", "Ephesians 2:10",
  "Ephesians 3:20", "Ephesians 4:2", "Ephesians 4:32", "Ephesians 5:2", "Ephesians 5:25", "Ephesians 6:1",
  "Ephesians 6:4", "Ephesians 6:10", "Ephesians 6:11", "Philippians 1:6", "Philippians 2:3", "Philippians 3:13-14",
  "Philippians 4:4", "Philippians 4:6-7", "Philippians 4:8", "Philippians 4:13", "Philippians 4:19",
  "Colossians 1:17", "Colossians 2:6-7", "Colossians 3:2", "Colossians 3:13", "Colossians 3:15",
  "Colossians 3:16", "Colossians 3:20", "Colossians 3:23", "1 Thessalonians 4:16-17", "1 Thessalonians 5:16-18",
  "2 Thessalonians 3:3", "1 Timothy 4:12", "1 Timothy 6:6", "2 Timothy 1:7", "2 Timothy 2:15", "2 Timothy 3:16",
  "2 Timothy 4:7", "Titus 2:11-12", "Hebrews 1:1-2", "Hebrews 4:12", "Hebrews 4:16", "Hebrews 10:23",
  "Hebrews 11:1", "Hebrews 11:4", "Hebrews 11:6", "Hebrews 12:1-2", "Hebrews 12:11", "Hebrews 13:5",
  "Hebrews 13:8", "James 1:2-3", "James 1:5", "James 1:17", "James 1:22", "James 4:7", "James 4:8",
  "James 5:16", "1 Peter 1:24-25", "1 Peter 2:9", "1 Peter 3:15", "1 Peter 5:6-7", "1 Peter 5:8",
  "2 Peter 1:3", "2 Peter 3:9", "1 John 1:7", "1 John 1:9", "1 John 3:1", "1 John 4:4", "1 John 4:18",
  "1 John 4:19", "1 John 5:4", "1 John 5:14", "Jude 1:24", "Revelation 1:8", "Revelation 3:20",
  "Revelation 21:4", "Revelation 22:12-13",
];
