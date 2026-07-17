using System;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace OpportunityBpfFix
{
    // Registered on Retrieve (Post-Operation, stage 40) for the opportunity
    // entity. A stock Microsoft plugin (PreOperationOpportunityRetrieve,
    // Microsoft.Dynamics.Sales.Plugins) nulls out stageid/processid/
    // traversedpath specifically on by-key Retrieve in this environment,
    // even though the same fields come back correctly via RetrieveMultiple.
    // This re-populates them from a RetrieveMultiple lookup (unaffected by
    // that plugin, since it's a different message) before the response
    // reaches the caller, so the BPF control on the model-driven form
    // renders the correct stage.
    public class RepopulateBpfFields : IPlugin
    {
        private static readonly string[] BpfFields = { "stageid", "processid", "traversedpath" };

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            if (context.MessageName != "Retrieve" || context.Stage != 40) return;
            if (!(context.OutputParameters["BusinessEntity"] is Entity entity)) return;
            if (entity.LogicalName != "opportunity") return;

            // Only act on fields the caller actually asked for (via the
            // Retrieve request's ColumnSet) — avoids an extra RetrieveMultiple
            // on every opportunity read that doesn't touch BPF fields at all.
            var columnSet = context.InputParameters.Contains("ColumnSet")
                ? context.InputParameters["ColumnSet"] as ColumnSet
                : null;
            var requestedFields = columnSet == null || columnSet.AllColumns
                ? BpfFields
                : BpfFields.Where(f => columnSet.Columns.Contains(f)).ToArray();

            // The stock plugin that nulls these out removes the attribute
            // entirely rather than setting it to null, so check both cases.
            var missing = requestedFields.Where(f => !entity.Contains(f) || entity[f] == null).ToArray();
            if (missing.Length == 0) return;

            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var service = factory.CreateOrganizationService(context.UserId);

            var query = new QueryExpression("opportunity")
            {
                ColumnSet = new ColumnSet(missing),
                Criteria = new FilterExpression
                {
                    Conditions = { new ConditionExpression("opportunityid", ConditionOperator.Equal, entity.Id) },
                },
            };

            var fresh = service.RetrieveMultiple(query).Entities.FirstOrDefault();
            if (fresh == null) return;

            foreach (var field in missing)
            {
                if (fresh.Contains(field))
                {
                    entity[field] = fresh[field];
                }
            }
        }
    }
}
