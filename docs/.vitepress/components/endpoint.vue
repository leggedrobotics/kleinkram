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
                        :show-double-quotes="false"
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
                        :show-double-quotes="false"
                        :deep="2"
                        :data="resolveSchemaRefs(params)"
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
                    v-if="schema[response.type]"
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
                        :show-double-quotes="false"
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



// eslint-disable-next-line unicorn/prevent-abbreviations, @typescript-eslint/no-explicit-any
function resolveSchemaRefs(schema: Record<string, any>): any {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!schema || typeof schema !== 'object') return schema;

    if (schema.$ref) {
        // Extract the reference name from the $ref string




        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const reference = schema.$ref.split('/').pop();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (props.schema[reference]) {
            // Recursively resolve the reference
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return resolveSchemaRefs(props.schema[reference]);
        }

        return 'No schema found';
    }

    if (Array.isArray(schema)) {
        // Recursively resolve each item in the array

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument
        return schema.map((item) => resolveSchemaRefs(item));
    }

    // Recursively resolve properties in an object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolvedSchema: any = {};
    for (const key in schema) {


        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        resolvedSchema[key] = resolveSchemaRefs(schema[key]);
    }

    return resolvedSchema;
}

// Helper function to get the first HTTP method available in the spec
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHttpMethod(spec: any) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return methods.find((method) => spec[method]);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const methodSpec = computed(() => props.spec[getHttpMethod(props.spec)]);

const params = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (methodSpec.value.parameters) {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return methodSpec.value.parameters;
    }
    return [];
});

// eslint-disable-next-line vue/return-in-computed-property
const dtoref = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (methodSpec.value.requestBody) {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return methodSpec.value.requestBody.content['application/json'].schema
            .$ref;
    }
});
// eslint-disable-next-line vue/return-in-computed-property
const body = computed(() => {
    if (dtoref.value) {



        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        return props.schema[dtoref.value.split('/')[3]];
    }
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bodyParameters = computed(() => {
    if (body.value) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return Object.entries(body.value.properties).map(([key, value]) => {


            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const required = body.value.required.includes(key);
            return {
                name: key,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                type: value.type,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                description: value.description,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                required,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                format: value.format,
            };
        });
    }
    return [];
});

const responses = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (methodSpec.value.responses) {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        return Object.entries(methodSpec.value.responses).map(

            ([code, response]) => {
                // eslint-disable-next-line unicorn/prevent-abbreviations
                const res = {
                    code,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    description: response.description,
                };
                if (
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    response.content?.['application/json']?.schema
                ) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (response.content['application/json'].schema.$ref) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        const reference: string =
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            response.content['application/json'].schema.$ref;
                        const splitReference = reference.split('/');
                        return { ...res, type: splitReference.at(-1) };
                    }
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (response.content['application/json'].schema?.items) {
                        // eslint-disable-next-line no-console
                        console.log(
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            response.content['application/json'].schema.items,
                        );
                        if (
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                            response.content['application/json'].schema
                                ?.type === 'array'
                        ) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            const splitReference =
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                                response.content[
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                                    'application/json'
                                    ].schema?.items.$ref.split('/');
                            return {
                                ...res,


                                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                                type: `${splitReference.at(-1)}[]`,
                            };
                        }
                        return {
                            ...res,

                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                            type: response.content['application/json'].schema
                                ?.items.type,
                        };
                    } else {
                        return {
                            ...res,

                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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


// eslint-disable-next-line unicorn/prevent-abbreviations, @typescript-eslint/no-unsafe-member-access
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
