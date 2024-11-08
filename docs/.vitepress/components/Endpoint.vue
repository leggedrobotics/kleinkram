<template>
    <div class="endpoint">
        <h4>{{ endpoint }}</h4>
        <p><strong>Method:</strong> {{ getHttpMethod(spec) }}</p>
        <p v-if="methodSpec?.summary">
            <strong>Summary:</strong> {{ methodSpec.summary }}
        </p>
        <p v-if="methodSpec?.description">
            <strong>Description:</strong>
            {{ methodSpec?.description }}
        </p>

        <div v-if="hasParams">
            <h4>Parameters</h4>
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
                                :datatype="
                                    parameter.schema?.format ||
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
                    <tr v-for="bodyParam in bodyParams">
                        <td>{{ bodyParam.name }}</td>
                        <td><Paramtype paramtype="body" /></td>
                        <td>
                            <Paramdatatype
                                :datatype="bodyParam.format || bodyParam.type"
                                :required="bodyParam.required"
                            />
                        </td>
                        <td>{{ bodyParam.description }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="methodSpec.responses">
            <h4>Responses</h4>
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
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Paramtype from './Paramtype.vue';
import Paramdatatype from './Paramdatatype.vue';
const props = defineProps<{
    endpoint: string;
    spec: unknown;
    schema: Record<string, unknown>;
}>();

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

const hasParams = computed(
    () => params.value.length > 0 || bodyParams.value.length > 0,
);
</script>

<style scoped>
.endpoint {
    border: 1px solid #ddd;
    padding: 16px;
    margin-bottom: 16px;
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
.param-col-3 {
    width: 12%;
}
.param-col-4 {
    width: 70%;
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
