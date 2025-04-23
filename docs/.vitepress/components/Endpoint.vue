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
                                    parameter.schema?.format ??
                                    parameter.schema.type
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
                    style="
                        background-color: white;
                        padding: 12px;
                        border: 1px solid #ddd;
                        margin-top: 2px;
                        font-size: 10px;
                        line-height: 12px;
                    "
                >
                    <vue-json-pretty
                        :deep="2"
                        :showDoubleQuotes="false"
                        :data="resolveSchemaRefs(methodSpec.requestBody)"
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
                    style="
                        background-color: white;
                        padding: 12px;
                        border: 1px solid #ddd;
                        margin-top: 2px;
                        font-size: 10px;
                        line-height: 12px;
                    "
                >
                    <vue-json-pretty
                        :showDoubleQuotes="false"
                        :deep="2"
                        :data="resolveSchemaRefs(params)"
                    />
                </div>
            </div>
            </template>

            <h4
                style="margin-bottom: 12px; margin-top: 16px"
                v-if="responses.map((r) => r.type).filter(Boolean).length"
            >
                Response
            </h4>

            <div
                :class="{ collapsed }"
                @click="toggleCollapse"
                v-for="(response, index) in responses"
                :key="response.code"
            >
                <br v-if="index !== 0" />
                <span>{{ response.type }}</span>
                <div
                    style="
                        background-color: white;
                        padding: 12px;
                        border: 1px solid #ddd;
                        margin-top: 2px;
                        font-size: 10px;
                        line-height: 12px;
                    "
                    v-if="schema[response.type]"
                >
                    <vue-json-pretty
                        :showDoubleQuotes="false"
                        :deep="2"
                        :data="resolveSchemaRefs(schema[response.type])"
                    />
                </div>
            </div>


        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Paramtype from './Paramtype.vue';
import Paramdatatype from './Paramdatatype.vue';
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

function resolveSchemaRefs(schema: Record<string, any>): any {
    if (!schema || typeof schema !== 'object') return schema;

    if (schema.$ref) {
        // Extract the reference name from the $ref string
        const ref = schema.$ref.split('/').pop();
        if (props.schema[ref]) {
            // Recursively resolve the reference
            return resolveSchemaRefs(props.schema[ref]);
        }

        return 'No schema found';
    }

    if (Array.isArray(schema)) {
        // Recursively resolve each item in the array
        return schema.map((item) => resolveSchemaRefs(item));
    }

    // Recursively resolve properties in an object
    const resolvedSchema: any = {};
    for (const key in schema) {
        resolvedSchema[key] = resolveSchemaRefs(schema[key]);
    }

    return resolvedSchema;
}

// Helper function to get the first HTTP method available in the spec
function getHttpMethod(spec: any) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    return methods.find((method) => spec[method]);
}

const methodSpec = computed(() => props.spec[getHttpMethod(props.spec)]);

const params = computed(() => {
    if (methodSpec.value.parameters) {
        return methodSpec.value.parameters;
    }
    return [];
});

const dtoref = computed(() => {
    if (methodSpec.value.requestBody) {
        return methodSpec.value.requestBody.content['application/json'].schema
            .$ref;
    }
});
const body = computed(() => {
    if (dtoref.value) {
        return props.schema[dtoref.value.split('/')[3]];
    }
});
const bodyParams = computed(() => {
    if (body.value) {
        return Object.entries(body.value.properties).map(([key, value]) => {
            const required = body.value.required.includes(key);
            return {
                name: key,
                type: value.type,
                description: value.description,
                required,
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
                const res = {
                    code,
                    description: response.description,
                };
                if (
                    response.content &&
                    response.content['application/json'] &&
                    response.content['application/json'].schema
                ) {
                    if (response.content['application/json'].schema['$ref']) {
                        const ref: string =
                            response.content['application/json'].schema.$ref;
                        const splitRef = ref.split('/');
                        return { ...res, type: splitRef[splitRef.length - 1] };
                    }
                    if (response.content['application/json'].schema?.items) {
                        console.log(
                            response.content['application/json'].schema.items,
                        );
                        if (
                            response.content['application/json'].schema
                                ?.type === 'array'
                        ) {
                            const splitRef =
                                response.content[
                                    'application/json'
                                    ].schema?.items['$ref'].split('/');
                            return {
                                ...res,
                                type: `${splitRef[splitRef.length - 1]}[]`,
                            };
                        }
                        return {
                            ...res,
                            type: response.content['application/json'].schema
                                ?.items.type,
                        };
                    } else {
                        return {
                            ...res,
                            type: response.content['application/json'].schema
                                .type,
                        };
                    }
                }
                return res;
            },
        );
    }
    return [];
});

const hasParams = computed(() => params.value.length > 0);
</script>

<style scoped>
.endpoint {
    border: 1px solid #ddd;
    padding: 16px;
    margin-bottom: 24px;
    background-color: #f9f9f9;
    border-radius: 8px;
}

h3 {
    color: #333;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}

th,
td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

th {
    background-color: #f4f4f4;
}

p {
    margin: 4px 0;
}

h4 {
    margin-top: 16px;
    color: #666;
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
</style>
