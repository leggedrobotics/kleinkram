SELECT "file"."uuid" AS "file_uuid"
FROM "file" "file"
    LEFT JOIN "run" "run" ON "run"."uuid"="file"."runUuid" AND ("run"."deletedAt" IS NULL)
    LEFT JOIN "topic" "topic" ON "topic"."runUuid"="file"."uuid" AND ("topic"."deletedAt" IS NULL)
    LEFT JOIN "project" "project" ON "project"."uuid"="run"."projectUuid" AND ("project"."deletedAt" IS NULL)
WHERE ( "topic"."name" IN ('/elevation_mapping/semantic_map', '/elevation_mapping/elevation_map_raw') ) AND
      ( "file"."deletedAt" IS NULL )
GROUP BY "file"."uuid"
HAVING COUNT(file.uuid) = 2;


SELECT "file"."uuid" AS "file_uuid" FROM "file" "file"
    LEFT JOIN "run" "run" ON "run"."uuid"="file"."runUuid" AND ("run"."deletedAt" IS NULL)
    LEFT JOIN "topic" "topic" ON "topic"."runUuid"="file"."uuid" AND ("topic"."deletedAt" IS NULL)
    LEFT JOIN "project" "project" ON "project"."uuid"="run"."projectUuid" AND ("project"."deletedAt" IS NULL)
                                    WHERE ("topic"."name" IN ('/elevation_mapping/elevation_map_raw', '/elevation_mapping/semantic_map') )
                                      AND ( "file"."deletedAt" IS NULL )
                                    GROUP BY "file"."uuid", "run"."uuid", "topic"."uuid", "project"."uuid"
                                    HAVING COUNT("file"."uuid") = 2;