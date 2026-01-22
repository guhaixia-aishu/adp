---
name: Ontology Schedule Management
overview: ""
todos: []
isProject: false
---

# Plan for Schedule Management

## Scope and Decisions

- **Scheduler style**: push-based (ontology-manager worker polls and triggers ontology-query)
- **Cron format**: standard 5-field crontab
- **Target service**: ontology-query handles action execution
