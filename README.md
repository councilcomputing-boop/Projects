# Project Overview

Brief description of what this project does. *(Fill this in when setting up.)*

## Quick Start

```bash
# Activate virtual environment
source venv/bin/activate   # Mac
venv\Scripts\activate      # Windows

# Start Claude
claude
```

## Project Structure

```
project-folder/
├── .claude/                    # Claude reads these automatically
│   ├── CLAUDE.md               # Session protocol
│   ├── PROJECT.md              # Business scope
│   ├── ARCHITECTURE.md         # Technical specs
│   ├── AI_CODING_GUIDELINES.md # Coding standards
│   └── SESSION_LOG.md          # Session history
├── venv/                       # Virtual environment
├── .gitignore
├── requirements.txt
└── README.md                   # This file
```

## Notes

- Always activate venv before starting Claude
- Keep sensitive data in `.env` (never commit)
- Update `.claude/SESSION_LOG.md` at end of each session
