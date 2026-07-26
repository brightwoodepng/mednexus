import type { PoolClient } from "pg"
import {
  THEORY_DEMO_SOURCE,
  theoryDemoCollections,
  theoryDemoDisciplines,
  theoryDemoModules,
  theoryDemoQuestions,
  theoryDemoSets,
  theoryDemoSummary,
} from "@/lib/theory-demo-content"

export async function seedTheoryDemo(client: PoolClient) {
  for (const collection of theoryDemoCollections) {
    await client.query(`INSERT INTO mednexus_theory_collections (id,slug,title,kind,status,sort_order)
      VALUES ($1,$2,$3,$4,'published',$5)
      ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug,title=EXCLUDED.title,kind=EXCLUDED.kind,
        status=EXCLUDED.status,sort_order=EXCLUDED.sort_order,updated_at=NOW()`,
    [collection.id, collection.slug, collection.title, collection.kind, collection.sortOrder])
  }
  for (const module of theoryDemoModules) {
    await client.query(`INSERT INTO mednexus_theory_modules (id,collection_id,name,description,sort_order)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO UPDATE SET collection_id=EXCLUDED.collection_id,name=EXCLUDED.name,
        description=EXCLUDED.description,sort_order=EXCLUDED.sort_order,updated_at=NOW()`,
    [module.id, module.collectionId, module.name, module.description, module.sortOrder])
  }
  for (const discipline of theoryDemoDisciplines) {
    await client.query(`INSERT INTO mednexus_theory_disciplines (id,collection_id,name,sort_order)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (id) DO UPDATE SET collection_id=EXCLUDED.collection_id,name=EXCLUDED.name,sort_order=EXCLUDED.sort_order`,
    [discipline.id, discipline.collectionId, discipline.name, discipline.sortOrder])
  }
  for (const set of theoryDemoSets) {
    await client.query(`INSERT INTO mednexus_theory_sets
      (id,collection_id,module_id,discipline_id,name,description,status,question_limit,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,'published',20,$7)
      ON CONFLICT (id) DO UPDATE SET collection_id=EXCLUDED.collection_id,module_id=EXCLUDED.module_id,
        discipline_id=EXCLUDED.discipline_id,name=EXCLUDED.name,description=EXCLUDED.description,
        status=EXCLUDED.status,question_limit=EXCLUDED.question_limit,sort_order=EXCLUDED.sort_order,updated_at=NOW()`,
    [set.id, set.collectionId, set.moduleId, set.disciplineId, set.name, set.description, set.sortOrder])
  }
  for (const item of theoryDemoQuestions) {
    await client.query(`INSERT INTO mednexus_theory_questions
      (id,collection_id,module_id,discipline_id,set_id,title,prompt,model_answer,key_marking_points,
       marks,media,tags,source_metadata,difficulty,estimated_study_minutes,status,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'[]'::jsonb,$11::jsonb,$12::jsonb,$13,$14,'published',$15)
      ON CONFLICT (id) DO UPDATE SET collection_id=EXCLUDED.collection_id,module_id=EXCLUDED.module_id,
        discipline_id=EXCLUDED.discipline_id,set_id=EXCLUDED.set_id,title=EXCLUDED.title,prompt=EXCLUDED.prompt,
        model_answer=EXCLUDED.model_answer,key_marking_points=EXCLUDED.key_marking_points,marks=EXCLUDED.marks,
        media=EXCLUDED.media,tags=EXCLUDED.tags,
        source_metadata=EXCLUDED.source_metadata,difficulty=EXCLUDED.difficulty,
        estimated_study_minutes=EXCLUDED.estimated_study_minutes,status=EXCLUDED.status,
        sort_order=EXCLUDED.sort_order,updated_at=NOW()`,
    [item.id, item.collectionId, item.moduleId, item.disciplineId, item.setId, item.title, item.prompt,
      item.modelAnswer, JSON.stringify(item.markingPoints), item.markingPoints.length * 2,
      JSON.stringify(item.tags), JSON.stringify({ demo: true, sourceTitle: THEORY_DEMO_SOURCE }),
      item.difficulty, item.estimatedStudyMinutes, item.sortOrder])
  }
  return theoryDemoSummary
}

