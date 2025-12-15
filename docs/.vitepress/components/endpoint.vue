<!-- eslint-disable vue/multi-word-component-names -->
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
// eslint-disable-next-line vue/multi-word-component-names
// eslint-disable-next-line unicorn/filename-case
<template>
    <div class="endpoint">
        <div style="margin-bottom: 16px; margin-top: 8px">
            <span>{{ getHttpMethod(spec).toUpperCase() }}</span>
            <span style="font-weight: 700; margin-left: 10px">{{
                    endpoint
                }}</span>
        </div>
        <p v-if="methodSpec?.summary">
            {{ methodSpec.summary }}
        </p>
        <p v-if="methodSpec?.description">
            {{ methodSpec?.description }}
        </p>

        <div v-if="hasParams">
            <h4 style="margin-bottom: 12px">Parameters</h4>
            <table>
                <thead>
                <tr>
                    <th class="param-col-1">Name</th>
                    <th class="param-col-2">In</th>
                    <th class="param-col-3">Type</th>
                    <th class="param-col-4">Description</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="parameter in params" :key="parameter.name">
                    <td class="param-col-1">{{ parameter.name }}</td>
                    <td class="param-col-2">
                        <Paramtype :paramtype="parameter.in" />
                    </td>
                    <td class="param-col-3">

                        <Paramdatatype
                            v-if="parameter.schema?.items?.type !== undefined"
                            :datatype="parameter.schema?.items?.type + '[]'"
                            :required="parameter.required"
                        />

                        <Paramdatatype
                            v-else
                            :datatype="
                                    (parameter.schema?.format ??
                                    parameter.schema?.type) ||
                                    'N/A'
                                "
                            :required="parameter.required"
                        />
                    </td>
                    <td class="param-col-4">
                        {{
                            parameter.description ||
                            'No description available'
                        }}
                    </td>
                </tr>
                </tbody>
            </table>
        </div>

        <div v-if="methodSpec.requestBody">
            <h4 style="margin-bottom: 12px; margin-top: 16px">RequestBody</h4>

            <div :class="{ collapsed }" @click="toggleCollapse">
                <div
                    class="json-box"
                >
                    <vue-json-pretty
                        :deep="2"
                        :show-double-quotes="false"
                        :data="resolveSchemaReferences(methodSpec.requestBody)"
                    />
                </div>
            </div>
        </div>

        <div v-if="methodSpec.responses">
            <h4 style="margin-bottom: 12px; margin-top: 16px">Responses</h4>
            <table>
                <thead>
                <tr>
                    <th class="res-col-1">Status Code</th>
                    <th class="res-col-2">Type</th>
                    <th class="res-col-3">Description</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="response in responses" :key="response.code">
                    <td class="res-col-1">{{ response.code }}</td>
                    <td class="res-col-2">{{ response.type || 'N/A' }}</td>
                    <td class="res-col-3">
                        {{
                            response.description ||
                            'No description available'
                        }}
                    </td>
                </tr>
                </tbody>
            </table>

            <template v-if="params.length > 0">
            <h4>Request Parameters</h4>

            <div
                :class="{ collapsed }"
                @click="toggleCollapse"
            >
                <div
                    class="json-box"
                >
                    <vue-json-pretty
                        :show-double-quotes="false"
                        :deep="2"
                        :data="resolveSchemaReferences(params)"
                    />
                </div>
            </div>
            </template>

            <h4
                v-if="responses.map((r) => r.type).some(Boolean)"
                style="margin-bottom: 12px; margin-top: 16px"
            >
                Response
            </h4>

            <div
                v-for="(response, index) in responses"
                :key="response.code"
                :class="{ collapsed }"
                @click="toggleCollapse"
            >
                <br v-if="index !== 0" />
                <span>{{ response.type }}</span>
                <div
                    v-if="response.type && schema[response.type]"
                    class="json-box"
                >
                    <vue-json-pretty
                        :show-double-quotes="false"
                        :deep="2"
                        :data="resolveSchemaReferences(schema[response.type]) as any"
                    />
                </div>
            </div>


        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Paramtype from './paramtype.vue';
import Paramdatatype from './paramdatatype.vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';

// Reactive state to control collapse/expand behavior
const collapsed = ref(true);

// Method to toggle the collapsed state
const toggleCollapse = () => {
    collapsed.value = !collapsed.value;
};

const props = defineProps<{
    endpoint: string;
    spec: unknown;
    schema: Record<string, unknown>;
}>();



interface ResponseSpec {
    description?: string;
    content?: Record<string, { schema?: { $ref?: string; items?: { $ref: string, type?: string }; type?: string } }>;
}

interface MethodSpec {
    summary?: string;
    description?: string;
    parameters?: {
        name: string;
        in: string;
        required: boolean;
        description?: string;
        schema?: { type?: string; format?: string; items?: { type?: string } };
    }[];
    requestBody?: {
        content: Record<string, { schema: { $ref: string } }>;
    };
    responses?: Record<string, ResponseSpec>;
}




function resolveSchemaReferences(
    schema: unknown,
    visitedReferences = new Set<string>(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {

    if (!schema || typeof schema !== 'object') return schema;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemaObject = schema as Record<string, any>;

    if (typeof schemaObject.$ref === 'string') {
        // Extract the reference name from the $ref string

        const reference = schemaObject.$ref.split('/').pop();


        if (!reference) return schema;

        if (visitedReferences.has(reference)) {
            return {
                type: 'object',
                description: `Circular reference to ${reference}`,
            };
        }

        const newVisitedReferences = new Set(visitedReferences);
        newVisitedReferences.add(reference);

        if (props.schema[reference]) {
            // Recursively resolve the reference
            return resolveSchemaReferences(props.schema[reference], newVisitedReferences);
        }

        return 'No schema found';
    }

    if (Array.isArray(schema)) {
        // Recursively resolve each item in the array

        // Recursively resolve each item in the array

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (schema).map((item) => resolveSchemaReferences(item, visitedReferences));
    }

    // Recursively resolve properties in an object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolvedSchema: Record<string, any> = {};
    for (const key in schemaObject) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        resolvedSchema[key] = resolveSchemaReferences(schemaObject[key], visitedReferences);
    }

    return resolvedSchema;
}

// Helper function to get the first HTTP method available in the spec
function getHttpMethod(spec: unknown) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specObject = spec as Record<string, any>;
    return methods.find((method) => specObject[method]) ?? '';
}


const methodSpec = computed(() => ((props.spec as Record<string, unknown>)[getHttpMethod(props.spec)] ?? {}) as MethodSpec);

const params = computed(() => {

    if ((methodSpec.value).parameters) {


        return (methodSpec.value).parameters;
    }
    return [];
});


const dtoref = computed(() => {
    return methodSpec.value.requestBody
        ? methodSpec.value.requestBody.content['application/json'].schema.$ref
        : undefined;
});

const body = computed(() => {

    return dtoref.value ? props.schema[dtoref.value.split('/')[3]] : undefined;
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bodyParameters = computed(() => {
    if (body.value) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        return Object.entries((body.value as any).properties).map(([key, value]: [string, any]) => {


            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            const required = (body.value as any).required.includes(key);
            return {
                name: key,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                type: value.type,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                description: value.description,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                required,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                format: value.format,
            };
        });
    }
    return [];
});

const responses = computed(() => {
    if (methodSpec.value.responses) {
        return Object.entries(methodSpec.value.responses).map(
            ([code, response]) => {

                const responseResult: { code: string; description: string | undefined; type?: string } = {
                    code,
                    description: response.description,
                };
                if (
                    response.content?.['application/json']?.schema
                ) {
                    if (response.content['application/json'].schema.$ref) {
                        const reference: string =
                            response.content['application/json'].schema.$ref;
                        const splitReference = reference.split('/');
                        return { ...responseResult, type: splitReference.at(-1) };
                    }
                    if (response.content['application/json'].schema.items) {
                        if (
                            response.content['application/json'].schema
                                .type === 'array'
                        ) {

                            const splitReference =
                                response.content[
                                    'application/json'
                                    ].schema.items.$ref.split('/');
                            return {
                                ...responseResult,
                                type: `${String(splitReference.at(-1))}[]`,
                            };
                        }
                        return {
                            ...responseResult,

                            type: response.content['application/json'].schema
                                .items.type,
                        };
                    } else {
                        return {
                            ...responseResult,

                            type: response.content['application/json'].schema
                                .type,
                        };
                    }
                }
                return responseResult;
            },
        );
    }
    return [];
});


// eslint-disable-next-line unicorn/prevent-abbreviations
const hasParams = computed(() => params.value.length > 0);
</script>

<style scoped>
.endpoint {
    border: 1px solid var(--vp-c-divider);
    padding: 16px;
    margin-bottom: 24px;
    background-color: var(--vp-c-bg-soft);
    border-radius: 8px;
}

h3 {
    color: var(--vp-c-text-1);
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}

th,
td {
    border: 1px solid var(--vp-c-divider);
    padding: 8px;
    text-align: left;
}

th {
    background-color: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
}

td {
    color: var(--vp-c-text-1);
}

p {
    margin: 4px 0;
    color: var(--vp-c-text-1);
}

h4 {
    margin-top: 16px;
    color: var(--vp-c-text-2);
}

.param-col-1 {
    width: 10%;
}

.param-col-2 {
    width: 8%;
}

.param-col-4 {
    width: 50%;
}

.res-col-1 {
    width: 10%;
}

.res-col-2 {
    width: 20%;
}

.res-col-3 {
    width: 70%;
}

.json-box {
    background-color: var(--vp-c-bg-mute);
    padding: 12px;
    border: 1px solid var(--vp-c-divider);
    margin-top: 2px;
    font-size: 10px;
    line-height: 12px;
    color: var(--vp-c-text-1);
}

:deep(.vjs-tree-node:hover) {
    background-color: var(--vp-c-bg-soft) !important;
}
</style>
