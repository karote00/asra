#!/bin/bash
# Update skills catalog to project SKILLS.md
npx openskills sync -y --output .project/SKILLS.md
echo "✅ Skills catalog updated to .project/SKILLS.md"