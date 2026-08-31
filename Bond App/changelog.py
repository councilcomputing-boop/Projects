# Release notes shown to users via the "What's New" popup on login.
# Add a new entry at the TOP of this list each time a batch of changes ships.
# Keys: version (str), date (YYYY-MM-DD), added / fixed / removed / changed (lists of strings, all optional).

CHANGELOG = [
    {
        'version': '1.0',
        'date': '2026-08-31',
        'added': [
            "'Did Not Bid' option for Bid Result, with a matching search filter",
            "'Waived' bond status, for when the final bond is waived or not required",
            "Report filters for Producer, Surety, Principal, and Bid Result",
        ],
        'fixed': [
            "Timestamps (Added At, Last Updated At, activity log) now display in your local time instead of the server's time zone",
        ],
    },
]
